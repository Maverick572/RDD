---
language:
- id
- en
license: mit
tags:
- object-detection
- road-damage-detection
- ssd-mobilenet-v2
- rdd2022
- smart-city
- tensorflow
datasets:
- rdd2022
metrics:
- map
---

# Road Damage Detection AI — SSD-MobileNetV2 FPNLite 640x640

Repository bobot model Deep Learning resmi untuk Tugas Akhir:
**"Penerapan YOLOv8 dan Convolutional Neural Network dalam Mendeteksi Kerusakan Jalan Berbasis Citra Digital"**

- **Peneliti:** Rifky Naufal Athaya (NIM: 12350312904)
- **Program Studi:** Sistem Informasi, Fakultas Sains dan Teknologi
- **Institusi:** Universitas Islam Negeri Sultan Syarif Kasim Riau
- **Web Demo (Vercel):** [https://rdd2022-road-damage-detection.vercel.app](https://rdd2022-road-damage-detection.vercel.app)

---

## Ringkasan Kinerja 3 Optimizer (100 Epochs, Batch Size 16):

| Optimizer | Test mAP@50 | Val mAP@50 | Latensi | FPS | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Adam** | **35.23%** | **34.78%** | **21.80 ms** | **45.87** | 🏆 **Juara 1 (Optimal)** |
| **SGD (Momentum)** | **29.63%** | **30.67%** | **25.54 ms** | **39.15** | 🥈 **Runner-up (Stabil)** |
| **RMSprop** | **1.46%** | **1.91%** | **23.26 ms** | **43.00** | 🥉 **Gagal Konvergen (Divergen)** |

---

## Standar Kerusakan Jalan (JRA 2013):
1. **D00:** Retak Memanjang (*Longitudinal Crack*)
2. **D10:** Retak Melintang (*Transverse Crack*)
3. **D20:** Retak Kulit Buaya (*Alligator Crack*)
4. **D40:** Lubang Jalan (*Pothole*)

---

## Struktur Berkas:
- `models/adam/` — SavedModel TensorFlow optimizer Adam (mAP@50 35.23%)
- `models/sgd/` — SavedModel TensorFlow optimizer SGD (mAP@50 29.63%)
- `models/rmsprop/` — SavedModel TensorFlow optimizer RMSprop (mAP@50 1.46%)
