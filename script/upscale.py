#!/usr/bin/env python3
"""Dependency-free Real-ESRGAN x4 upscaler for the local edit server.

The `realesrgan`/`basicsr` packages do not install on this project's
Python (basicsr's build fails on modern interpreters and it is
unmaintained), so this module vendors the minimal RRDBNet architecture
needed to run the official RealESRGAN_x4plus weights with torch only
(torch + Pillow + numpy are already in the project .venv).

Weights (~64MB) download once from the upstream release into
~/.cache/mflux-edit/ and are reused afterwards.

Usage:
    from upscale import upscale_png_bytes
    out_png = upscale_png_bytes(png_or_jpeg_bytes)  # 4x width and height
"""

import io
import os
import urllib.request

WEIGHTS_URL = ("https://github.com/xinntao/Real-ESRGAN/releases/"
               "download/v0.1.0/RealESRGAN_x4plus.pth")
CACHE_DIR = os.path.join(os.path.expanduser("~"), ".cache", "mflux-edit")
WEIGHTS_PATH = os.path.join(CACHE_DIR, "RealESRGAN_x4plus.pth")
SCALE = 4

_model = None
_device = None


def _get_device():
    global _device
    if _device is None:
        import torch
        _device = torch.device(
            "mps" if torch.backends.mps.is_available() else "cpu")
    return _device


def _rrdb_net():
    """RRDBNet matching the RealESRGAN_x4plus checkpoint exactly.

    Verified by loading the checkpoint with strict=True: any shape or
    key mismatch raises instead of silently producing garbage.
    """
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class ResidualDenseBlock(nn.Module):
        def __init__(self, num_feat=64, num_grow_ch=32):
            super().__init__()
            self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
            self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch,
                                   3, 1, 1)
            self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch,
                                   3, 1, 1)
            self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch,
                                   3, 1, 1)
            self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat,
                                   3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class RRDB(nn.Module):
        def __init__(self, num_feat, num_grow_ch=32):
            super().__init__()
            self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
            self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
            self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

        def forward(self, x):
            out = self.rdb1(x)
            out = self.rdb2(out)
            out = self.rdb3(out)
            return out * 0.2 + x

    class RRDBNet(nn.Module):
        def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64,
                     num_block=23, num_grow_ch=32):
            super().__init__()
            self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
            self.body = nn.Sequential(*[
                RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
            self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

        def forward(self, x):
            feat = self.conv_first(x)
            body_feat = self.conv_body(self.body(feat))
            feat = feat + body_feat
            feat = self.lrelu(self.conv_up1(F.interpolate(
                feat, scale_factor=2, mode="nearest")))
            feat = self.lrelu(self.conv_up2(F.interpolate(
                feat, scale_factor=2, mode="nearest")))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    return RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23,
                   num_grow_ch=32)


def _ensure_weights():
    if not os.path.exists(WEIGHTS_PATH):
        os.makedirs(CACHE_DIR, exist_ok=True)
        tmp = WEIGHTS_PATH + ".part"
        urllib.request.urlretrieve(WEIGHTS_URL, tmp)
        os.replace(tmp, WEIGHTS_PATH)
    return WEIGHTS_PATH


def get_model():
    """Load the x4plus model once per process; strict load validates it."""
    global _model
    if _model is None:
        import torch
        model = _rrdb_net()
        state = torch.load(_ensure_weights(), map_location="cpu")
        key = ("params_ema" if isinstance(state, dict)
               and "params_ema" in state else "params")
        params = state[key] if isinstance(state, dict) else state
        model.load_state_dict(params, strict=True)
        model.eval().to(_get_device())
        _model = model
    return _model


def _run_full(model, img):
    import torch
    with torch.no_grad():
        return model(img).clamp_(0, 1)


def _run_tiled(model, img, tile=512, overlap=32):
    """Overlap-and-crop tiled inference; fallback when full-frame OOMs."""
    import torch
    _, _, h, w = img.shape
    out = torch.zeros(1, 3, h * SCALE, w * SCALE)
    stride = tile - overlap
    with torch.no_grad():
        for y in range(0, h, stride):
            for x in range(0, w, stride):
                y1, x1 = min(y + tile, h), min(x + tile, w)
                y0, x0 = max(y1 - tile, 0), max(x1 - tile, 0)
                pred = model(img[:, :, y0:y1, x0:x1]).clamp_(0, 1)
                oy0, ox0 = (y0 - y) * SCALE, (x0 - x) * SCALE
                oy1 = oy0 + (y1 - y0) * SCALE
                ox1 = ox0 + (x1 - x0) * SCALE
                out[:, :, y * SCALE + oy0:y * SCALE + oy1,
                    x * SCALE + ox0:x * SCALE + ox1] = pred[
                        :, :, oy0:oy1, ox0:ox1]
    return out


def upscale_png_bytes(data):
    """Upscale PNG/JPEG bytes 4x; returns PNG bytes at 4x width/height."""
    import numpy as np
    import torch
    from PIL import Image
    with Image.open(io.BytesIO(data)) as im:
        rgb = im.convert("RGB")
        in_size = rgb.size
    arr = (np.asarray(rgb).astype(np.float32) / 255.0).transpose(2, 0, 1)
    img = torch.from_numpy(arr).unsqueeze(0).to(_get_device())
    model = get_model()
    try:
        out = _run_full(model, img)
    except RuntimeError:
        if _get_device().type == "mps":
            torch.mps.empty_cache()
        out = _run_tiled(model, img)
    out = (out.squeeze(0).clamp(0, 1).cpu().numpy()
           .transpose(1, 2, 0) * 255.0).round().astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(out).save(buf, format="PNG")
    assert Image.open(io.BytesIO(buf.getvalue())).size == (
        in_size[0] * SCALE, in_size[1] * SCALE)
    return buf.getvalue()
