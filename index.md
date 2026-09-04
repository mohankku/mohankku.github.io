---
layout: default
title: Home
---

<div class="hero-banner">
  <div class="hero-lead">
    I am a Research Scientist at <strong>Meta Reality Labs</strong> focused on accelerating machine learning inference on embedded devices. I received my Ph.D. in Computer Science from the <strong>Georgia Institute of Technology</strong>, where I specialized in Systems under the advisement of <a href="https://taesoo.kim/" target="_blank" rel="noopener">Dr. Taesoo Kim</a>. My doctoral thesis, <em>Taming Latency In Data Center Applications</em>, is available <a href="https://repository.gatech.edu/entities/publication/ab1794f4-1142-4aa0-bb58-37aa7d29d520" target="_blank" rel="noopener">here</a>.
  </div>

  <div class="stat-grid">
    <div class="stat-item">
      <span class="stat-val highlight">Meta Reality Labs</span>
      <span class="stat-lbl">Research Scientist</span>
    </div>
    <div class="stat-item">
      <span class="stat-val highlight">Georgia Tech</span>
      <span class="stat-lbl">Ph.D. in Computer Science</span>
    </div>
    <div class="stat-item">
      <span class="stat-val award">2 Awards 🏆</span>
      <span class="stat-lbl">Best Paper & Student Paper</span>
    </div>
    <div class="stat-item">
      <span class="stat-val">10+ Papers</span>
      <span class="stat-lbl">ASPLOS · EuroSys · TACO</span>
    </div>
  </div>

  <div class="topic-pills">
    <span class="topic-pill"><i class="fa-solid fa-microchip"></i> On-Device ML</span>
    <span class="topic-pill"><i class="fa-solid fa-bolt"></i> Edge NPUs & Accelerators</span>
    <span class="topic-pill"><i class="fa-solid fa-layer-group"></i> PyTorch & Quantization</span>
    <span class="topic-pill"><i class="fa-solid fa-memory"></i> Memory Systems & TLB Coherence</span>
    <span class="topic-pill"><i class="fa-solid fa-gears"></i> Kernel & OS Architecture</span>
    <span class="topic-pill"><i class="fa-solid fa-network-wired"></i> Distributed Systems</span>
  </div>
</div>

<h2 id="research-focus">Research Focus</h2>

<div class="research-grid">
  <div class="research-card">
    <div class="research-card-icon"><i class="fa-solid fa-microchip"></i></div>
    <h3>On-Device ML & Edge NPUs</h3>
    <p>Accelerating inference across resource-constrained devices, spanning Transformers, CNNs, and RNNs through quantization and compiler optimizations.</p>
    <ul class="research-card-bullets">
      <li>Efficient PyTorch graph & kernel implementations</li>
      <li>Model compression & int8/int4 quantization</li>
      <li>SoC vendor collaboration on NPU/eNPU specs</li>
    </ul>
  </div>

  <div class="research-card">
    <div class="research-card-icon"><i class="fa-solid fa-memory"></i></div>
    <h3>OS & Memory Systems</h3>
    <p>Architecting virtual memory, lazy translation coherence, and operating systems tailored for many-core and heterogeneous compute platforms.</p>
    <ul class="research-card-bullets">
      <li>Lazy Translation Coherence (LATR - ASPLOS'18)</li>
      <li>Eventually Consistent TLBs (ECOTLB - ACM TACO'20)</li>
      <li>Data-centric OS for accelerators (SOLROS - EuroSys'18)</li>
    </ul>
  </div>

  <div class="research-card">
    <div class="research-card-icon"><i class="fa-solid fa-shield-halved"></i></div>
    <h3>Secure & Scalable Systems</h3>
    <p>Developing high-throughput distributed graph processing and hardware enclave security mechanisms for virtualized network functions.</p>
    <ul class="research-card-bullets">
      <li>Trillion-edge graph engine (Mosaic - EuroSys'17)</li>
      <li>SGX-secured state isolation (S-NFV - Best Paper)</li>
      <li>Ordered TCP server processing (TCP Ordo - INFOCOM'16)</li>
    </ul>
  </div>
</div>

<h2 id="experience">Experience & Education</h2>

<div class="timeline-list">
  <div class="timeline-card">
    <div class="timeline-header">
      <span class="timeline-role">Research Scientist</span>
      <span class="timeline-date">2019 &mdash; Present</span>
    </div>
    <div class="timeline-org">
      <i class="fa-brands fa-meta"></i> Meta Reality Labs &middot; Cupertino, CA
    </div>
    <p class="timeline-desc">
      Focused on accelerating machine learning inference on embedded devices. My work encompasses optimizing and deploying diverse ML architectures—including CNNs, RCNNs, RNNs, and transformers—onto resource-constrained hardware platforms. I leverage PyTorch and related frameworks to develop efficient model implementations and quantization techniques for edge deployment. Additionally, I partner with SoC vendors to architect NPU/eNPU specifications that enable more efficient and effective hardware solutions for on-device ML inference.
    </p>
  </div>

  <div class="timeline-card">
    <div class="timeline-header">
      <span class="timeline-role">Ph.D. in Computer Science</span>
      <span class="timeline-date">2013 &mdash; 2019</span>
    </div>
    <div class="timeline-org">
      <i class="fa-solid fa-graduation-cap"></i> Georgia Institute of Technology &middot; Atlanta, GA
    </div>
    <p class="timeline-desc">
      Specialized in Computer Systems under the advisement of <a href="https://taesoo.kim/" target="_blank" rel="noopener">Dr. Taesoo Kim</a>. Research focused on operating systems, virtual memory translation coherence (TLBs), low-latency data center architectures, and enclave-protected network functions. Doctoral thesis: <a href="https://repository.gatech.edu/entities/publication/ab1794f4-1142-4aa0-bb58-37aa7d29d520" target="_blank" rel="noopener"><em>Taming Latency In Data Center Applications</em></a>.
    </p>
  </div>
</div>

<h2 id="service">Professional Service & Engagement</h2>

<div class="service-grid">
  <div class="service-card">
    <div class="service-badge"><i class="fa-solid fa-check-to-slot"></i> Program Committee</div>
    <div class="service-venue"><a href="https://mlsys26.hotcrp.com/users/pc" target="_blank" rel="noopener">MLSys 2026 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 13px; margin-left: 4px;"></i></a></div>
    <p class="service-desc">Conference on Machine Learning and Systems</p>
  </div>

  <div class="service-card">
    <div class="service-badge"><i class="fa-solid fa-check-to-slot"></i> Program Committee</div>
    <div class="service-venue"><a href="https://www.usenix.org/conference/atc20#organizers" target="_blank" rel="noopener">USENIX ATC 2020 <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 13px; margin-left: 4px;"></i></a></div>
    <p class="service-desc">USENIX Annual Technical Conference</p>
  </div>
</div>

<h2 id="publications">Publications</h2>

<div class="pub-filter-bar">
  <button type="button" class="pub-filter-btn active" data-filter="all">All Papers</button>
  <button type="button" class="pub-filter-btn" data-filter="award">🏆 Award Winning</button>
  <button type="button" class="pub-filter-btn" data-filter="systems">Systems & Architecture</button>
  <button type="button" class="pub-filter-btn" data-filter="netsec">Networking & Security</button>
</div>

<div class="pub-list">

  <!-- ECOTLB -->
  <div class="pub-card" data-category="systems">
    <div class="pub-header">
      <span class="pub-venue-badge">ACM TACO '20</span>
      <span class="pub-stat-chip">ACM Transactions on Architecture and Code Optimization</span>
    </div>
    <h3 class="pub-title"><a href="./data/ecotlb.pdf" target="_blank">ECOTLB: Eventually Consistent TLBs</a></h3>
    <div class="pub-authors">
      Steffen Maass, <strong>Mohan Kumar</strong>, Taesoo Kim, Tushar Krishna, and Abhishek Bhattacharjee.
    </div>
    <div class="pub-actions">
      <a href="./data/ecotlb.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@article{maass2020ecotlb,
  title={ECOTLB: Eventually Consistent TLBs},
  author={Maass, Steffen and Kumar, Mohan and Kim, Taesoo and Krishna, Tushar and Bhattacharjee, Abhishek},
  journal={ACM Transactions on Architecture and Code Optimization (TACO)},
  volume={17},
  number={4},
  pages={1--25},
  year={2020},
  publisher={ACM}
}</pre>
    </div>
  </div>

  <!-- SOLROS -->
  <div class="pub-card" data-category="systems">
    <div class="pub-header">
      <span class="pub-venue-badge">EuroSys '18</span>
      <span class="pub-stat-chip">Porto, Portugal &middot; 16.4% acceptance rate</span>
    </div>
    <h3 class="pub-title"><a href="./data/solros.pdf" target="_blank">SOLROS: A Data-Centric Operating System Architecture for Heterogeneous Computing</a></h3>
    <div class="pub-authors">
      Changwoo Min, Woon-Hak Kang, <strong>Mohan Kumar</strong>, Sanidhya Kashyap, Steffen Maass, Heeseung Jo, and Taesoo Kim.
    </div>
    <div class="pub-actions">
      <a href="./data/solros.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@inproceedings{min2018solros,
  title={SOLROS: A data-centric operating system architecture for heterogeneous computing},
  author={Min, Changwoo and Kang, Woon-Hak and Kumar, Mohan and Kashyap, Sanidhya and Maass, Steffen and Jo, Heeseung and Kim, Taesoo},
  booktitle={Proceedings of the Thirteenth EuroSys Conference},
  pages={1--15},
  year={2018}
}</pre>
    </div>
  </div>

  <!-- LATR -->
  <div class="pub-card" data-category="systems">
    <div class="pub-header">
      <span class="pub-venue-badge">ASPLOS '18</span>
      <span class="pub-stat-chip">Williamsburg, VA, USA &middot; 17.6% acceptance rate</span>
    </div>
    <h3 class="pub-title"><a href="./data/latr.pdf" target="_blank">LATR: Lazy Translation Coherence</a></h3>
    <div class="pub-authors">
      <strong>Mohan Kumar</strong>, Steffen Maass, Sanidhya Kashyap, Jan Vesely, Zi Yan, Taesoo Kim, Abhishek Bhattacharjee, and Tushar Krishna.
    </div>
    <div class="pub-actions">
      <a href="./data/latr.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@inproceedings{kumar2018latr,
  title={LATR: lazy translation coherence},
  author={Kumar, Mohan and Maass, Steffen and Kashyap, Sanidhya and Vesel{\`y}, Jan and Yan, Zi and Kim, Taesoo and Bhattacharjee, Abhishek and Krishna, Tushar},
  booktitle={Proceedings of the Twenty-Third International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS)},
  pages={651--664},
  year={2018}
}</pre>
    </div>
  </div>

  <!-- Mosaic (Award) -->
  <div class="pub-card award-winning" data-category="award systems">
    <div class="pub-header">
      <span class="pub-venue-badge">EuroSys '17</span>
      <span class="pub-award-badge"><i class="fa-solid fa-trophy"></i> Best Student Paper Award</span>
      <span class="pub-stat-chip">Belgrade, Serbia &middot; 20.5% acceptance rate</span>
    </div>
    <h3 class="pub-title"><a href="./data/mosaic.pdf" target="_blank">Mosaic: Processing a Trillion-Edge Graph on a Single Commodity Machine</a></h3>
    <div class="pub-authors">
      Steffen Maass, Changwoo Min, Sanidhya Kashyap, Woonhak Kang, <strong>Mohan Kumar</strong>, and Taesoo Kim.
    </div>
    <div class="pub-actions">
      <a href="./data/mosaic.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@inproceedings{maass2017mosaic,
  title={Mosaic: Processing a trillion-edge graph on a single commodity machine},
  author={Maass, Steffen and Min, Changwoo and Kashyap, Sanidhya and Kang, Woonhak and Kumar, Mohan and Kim, Taesoo},
  booktitle={Proceedings of the Twelfth European Conference on Computer Systems (EuroSys)},
  pages={527--543},
  year={2017},
  note={Best Student Paper Award}
}</pre>
    </div>
  </div>

  <!-- S-NFV (Award) -->
  <div class="pub-card award-winning" data-category="award netsec">
    <div class="pub-header">
      <span class="pub-venue-badge">SDN-NFV Security '16</span>
      <span class="pub-award-badge"><i class="fa-solid fa-trophy"></i> Best Paper Award</span>
      <span class="pub-stat-chip">New Orleans, LA, USA &middot; Presented at NFV World Congress</span>
    </div>
    <h3 class="pub-title"><a href="./data/snfv.pdf" target="_blank">S-NFV: Securing NFV states by using SGX</a></h3>
    <div class="pub-authors">
      Ming-Wei Shih, <strong>Mohan Kumar</strong>, Taesoo Kim, and Ada Gavrilovska.
    </div>
    <div class="pub-actions">
      <a href="./data/snfv.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> PDF</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@inproceedings{shih2016s,
  title={S-NFV: Securing NFV states by using SGX},
  author={Shih, Ming-Wei and Kumar, Mohan and Kim, Taesoo and Gavrilovska, Ada},
  booktitle={Proceedings of the 2016 ACM International Workshop on Security in Software Defined Networks & Network Function Virtualization (SDN-NFV Security)},
  pages={45--48},
  year={2016},
  note={Best Paper Award}
}</pre>
    </div>
  </div>

  <!-- TCP Ordo -->
  <div class="pub-card" data-category="netsec">
    <div class="pub-header">
      <span class="pub-venue-badge">INFOCOM '16</span>
      <span class="pub-stat-chip">San Francisco, CA, USA &middot; 18.25% acceptance rate</span>
    </div>
    <h3 class="pub-title"><a href="https://ieeexplore.ieee.org/document/7524601" target="_blank" rel="noopener">TCP Ordo: The cost of ordered processing in TCP Servers</a></h3>
    <div class="pub-authors">
      <strong>Mohan Kumar</strong> and Ada Gavrilovska.
    </div>
    <div class="pub-actions">
      <a href="https://ieeexplore.ieee.org/document/7524601" class="pub-btn" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> IEEE Xplore</a>
      <button type="button" class="pub-btn pub-toggle-bibtex" aria-expanded="false"><i class="fa-solid fa-quote-right"></i> BibTeX</button>
    </div>
    <div class="pub-bibtex-box">
      <button type="button" class="pub-copy-btn"><i class="fa-regular fa-copy"></i> Copy</button>
      <pre>@inproceedings{kumar2016tcp,
  title={TCP ordo: The cost of ordered processing in TCP servers},
  author={Kumar, Mohan and Gavrilovska, Ada},
  booktitle={IEEE INFOCOM 2016 - The 35th Annual IEEE International Conference on Computer Communications},
  pages={1--9},
  year={2016},
  organization={IEEE}
}</pre>
    </div>
  </div>

</div>

<h2 id="posters">Posters & Presentations</h2>

<div class="pub-list">
  <!-- mKPAC -->
  <div class="pub-card" data-category="systems">
    <div class="pub-header">
      <span class="pub-venue-badge">Middleware '18</span>
      <span class="pub-stat-chip">Rennes, France</span>
    </div>
    <h3 class="pub-title"><a href="https://dl.acm.org/doi/10.1145/3284014.3284022" target="_blank" rel="noopener">mKPAC: Kernel Packet Processing for Manycore Systems</a></h3>
    <div class="pub-authors">
      Ramneek, <strong>Mohan Kumar</strong>, Taesoo Kim, and Sungin Jung.
    </div>
    <div class="pub-actions">
      <a href="https://dl.acm.org/doi/10.1145/3284014.3284022" class="pub-btn" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ACM DL</a>
    </div>
  </div>

  <!-- Network Function Fault Isolation -->
  <div class="pub-card" data-category="netsec">
    <div class="pub-header">
      <span class="pub-venue-badge">NSDI '17 Poster</span>
      <span class="pub-stat-chip">Boston, MA, USA</span>
    </div>
    <h3 class="pub-title"><a href="./data/nfv-fault-poster.pdf" target="_blank">Network Function Fault Isolation in a Single Address Space</a></h3>
    <div class="pub-authors">
      <strong>Mohan Kumar</strong>, Steffen Maass, and Taesoo Kim.
    </div>
    <div class="pub-actions">
      <a href="./data/nfv-fault-poster.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> Poster PDF</a>
    </div>
  </div>

  <!-- DistCoz -->
  <div class="pub-card" data-category="systems">
    <div class="pub-header">
      <span class="pub-venue-badge">NSDI '17 Poster</span>
      <span class="pub-stat-chip">Boston, MA, USA</span>
    </div>
    <h3 class="pub-title"><a href="./data/dist-coz-poster.pdf" target="_blank">DistCoz: Tell Me What to Optimize in My Distributed Application</a></h3>
    <div class="pub-authors">
      Steffen Maass, <strong>Mohan Kumar</strong>, and Taesoo Kim.
    </div>
    <div class="pub-actions">
      <a href="./data/dist-coz-poster.pdf" class="pub-btn" target="_blank"><i class="fa-solid fa-file-pdf"></i> Poster PDF</a>
    </div>
  </div>

  <!-- VNFStore -->
  <div class="pub-card" data-category="netsec">
    <div class="pub-header">
      <span class="pub-venue-badge">SOSP '15 Workshop</span>
      <span class="pub-stat-chip">Diversity Workshop at SOSP'15 &middot; Monterey, CA</span>
    </div>
    <h3 class="pub-title">VNFStore: NFV State Externalizing Framework</h3>
    <div class="pub-authors">
      <strong>Mohan Kumar</strong> and Ada Gavrilovska.
    </div>
  </div>
</div>
