# Mini ASS Editor

Aplikasi desktop untuk mengedit, menyinkronkan, dan membakar subtitle ASS ke video di **Windows dan macOS**. Video dan subtitle diproses lokal; aplikasi tidak membutuhkan akun, backend, atau koneksi internet saat digunakan.

## Download dan instalasi

Versi terbaru: **[v0.1.2](https://github.com/ljcom/ass-editor/releases/tag/v0.1.2)**, dengan Burn MP4, Set Start, dan Set End per baris.

| Platform | Installer | Alternatif |
| --- | --- | --- |
| Windows x64 | [Setup.exe](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-windows-x64-Setup.exe) | [ZIP portable](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-win-x64.zip) |
| Mac Apple Silicon | [DMG arm64](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-mac-arm64.dmg) | [ZIP arm64](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-mac-arm64.zip) |
| Mac Intel | [DMG x64](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-mac-x64.dmg) | [ZIP x64](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/Mini-ASS-Editor-0.1.2-mac-x64.zip) |

[SHA256SUMS.txt](https://github.com/ljcom/ass-editor/releases/download/v0.1.2/SHA256SUMS.txt) memuat checksum keenam paket.

- **Windows:** jalankan installer, atau ekstrak ZIP lalu buka `Mini ASS Editor.exe`. Semua file dalam folder ZIP dibutuhkan.
- **Mac:** buka DMG lalu seret aplikasi ke Applications, atau ekstrak ZIP dan buka aplikasi.

Paket Windows belum ditandatangani. Paket Mac memakai signature ad-hoc dan belum dinotarisasi oleh Apple. Windows SmartScreen atau macOS Gatekeeper mungkin meminta persetujuan saat pertama dibuka. FFmpeg sudah disertakan untuk fitur Burn; pengguna tidak perlu menginstalnya terpisah.

## Mulai menggunakan

1. Klik **Open Video** untuk membuka MP4, MOV, atau WebM dengan codec yang didukung player.
2. Klik **Open ASS** untuk membuka subtitle ASS/SSA UTF-8.
3. Klik baris untuk memilihnya dan memindahkan video ke Start baris tersebut.
4. Klik dua kali **Start**, **End**, **Style**, atau **Text** untuk mengedit. Tekan **Enter** untuk menerapkan edit atau **Escape** untuk membatalkan.
5. Sesuaikan timing melalui tombol per baris, kontrol di bawah tabel, atau **Rearrange**.
6. Klik **Save ASS** untuk menyimpan file aktif, **Save As…** untuk menyimpan salinan, atau **Burn** untuk menghasilkan MP4 dengan subtitle permanen.

Perubahan belum disimpan ditandai `*` pada nama file. Membuka subtitle lain atau menutup aplikasi menampilkan pilihan **Save / Discard / Cancel**. Impor SSA disimpan sebagai ASS melalui Save As.

Player menyediakan play/pause, seek, volume, dan kecepatan 0.5–2×. Seret garis pemisah untuk mengubah ukuran panel video dan tabel. Dialog Open Video, Open ASS, dan Save As mengingat folder terakhir; Burn memakai folder simpan terakhir.

## Mengedit dan memilih baris

- **Text** memakai editor multiline dengan word wrap dan tinggi otomatis. **Shift+Enter** menambah baris baru, yang disimpan sebagai `\N` pada ASS. Override tags tetap dapat diedit.
- **＋ Add** menambah subtitle pada waktu video saat ini.
- **Insert Line** menyisipkan subtitle kosong setelah baris terpilih, atau pada waktu video jika belum ada seleksi.
- **Delete Line** menghapus seluruh baris terpilih.
- **Cmd-klik** pada Mac atau **Ctrl-klik** pada Windows menambah/menghapus baris dari seleksi. **Shift-klik** memilih rentang. Klik dengan modifier mempertahankan posisi video.

Baris selalu diurutkan berdasarkan Start, termasuk saat disimpan. Start yang sama mempertahankan urutan relatif baris. Seleksi mengikuti ID baris saat urutan berubah.

### Search

Kolom **Search** memfilter teks tanpa membedakan huruf besar/kecil dan mengabaikan tag ASS. **Cmd/Ctrl+F** memfokuskan pencarian; **Escape** atau **×** menghapus filter.

Nomor baris mengikuti urutan seluruh subtitle; jumlah hasil dan total ditampilkan di atas tabel. Seleksi yang tersembunyi dilepas saat filter berubah, dan Shift-klik memilih rentang yang terlihat. Save dan Burn tetap memakai seluruh subtitle.

## Mengatur timing

### Tombol Set Start per baris

**Set Start** di kolom Timing mengambil waktu video langsung saat diklik, ketika pause maupun play. End ikut bergeser sehingga durasi semula tetap, dengan penyesuaian berikut:

- Baris yang berada sebelum Start baru dan End-nya melewati Start baru dipotong End-nya menjadi **Start baru − 100 ms**. Baris yang sudah selesai tidak diperpanjang.
- Jika pemotongan menghasilkan durasi tidak valid, baris tersebut dipindahkan ke sesudah baris yang diklik.
- Baris yang konflik setelahnya digeser berantai, dengan jeda **10 ms**, sampai ada celah.
- Jika rantai konflik melewati akhir video, durasinya dipadatkan secara proporsional agar muat. Start baris yang diklik tetap pada waktu video, dengan durasi dan jeda minimal 10 ms.
- Durasi lama yang melebihi panjang video memakai fallback 2 detik. End yang melewati akhir video disesuaikan dengan sisa waktu yang tersedia.

Baris yang diklik disorot dan digulirkan ke tampilan tanpa seek atau menghentikan playback. Tombol tetap tersedia untuk baris di luar durasi video. Timing yang tidak valid ditolak tanpa perubahan parsial.

### Tombol Set End per baris

**Set End** mengambil waktu video langsung saat diklik, ketika pause maupun play. Hanya End baris tersebut yang berubah; Start dan baris lain tetap. Durasi menyesuaikan End baru. End harus sesudah Start dan menghasilkan durasi yang valid pada presisi ASS.

### Kontrol di bawah tabel

**Set Start / Set End** di bawah tabel dan shortcut terkait mengubah satu timestamp baris aktif secara langsung, tanpa penyesuaian konflik seperti tombol Set Start per baris. Tombol **Shift** menggeser Start dan End baris aktif sebesar −1000, −100, −10, +10, +100, atau +1000 ms.

### Rearrange

Pilih beberapa baris, lalu klik **Rearrange**. Pilihan awal memakai baris terpilih, atau seluruh subtitle jika belum ada seleksi. Cakupan **Seluruh subtitle** dan **Rentang nomor baris** juga tersedia.

Waktu asal dan baru otomatis terisi dari Start paling awal dan End paling akhir pada pilihan. Isi rentang baru, lalu klik **Apply Timing** untuk menyesuaikan Start, End, durasi, dan jeda secara proporsional. Baris di luar pilihan tetap.

Contoh: baris 1–5 dengan rentang `00:30`–`04:30` dipetakan ke `00:45`–`03:30`. Titik awal menjadi `00:45`, titik akhir menjadi `03:30`, dan durasi serta jeda menjadi 68.75% dari sebelumnya.

Input Rearrange menerima `MM:SS`, `MM:SS.mmm`, atau `HH:MM:SS.mmm`. Waktu relatif dalam tag karaoke/animasi ASS tidak dihitung ulang.

## Burn ke MP4

1. Buka video dan ASS, lalu selesaikan edit teks/timing.
2. Klik **Burn**, lalu pilih lokasi dan nama file melalui **Save As MP4**.
3. Tunggu pesan selesai. Progres menampilkan waktu video yang sudah diproses; **Cancel Burn** membatalkan proses.

Burn memakai seluruh subtitle saat tombol diklik, termasuk perubahan yang belum disimpan. Video sumber, file ASS, status perubahan, dan posisi playback tetap. Output baru ditempatkan di tujuan setelah encoding berhasil; proses gagal atau dibatalkan membersihkan file sementara. File sumber tidak dapat dipilih sebagai tujuan.

Burn merender style dan warna ASS menggunakan FFmpeg/libass, lalu menghasilkan video H.264 dan audio AAC dalam MP4. Font menggunakan font yang tersedia di sistem. Preview dalam editor memakai CSS, sehingga efek ASS kompleks dapat berbeda dari hasil Burn.

## Shortcut

Gunakan **Cmd** pada Mac atau **Ctrl** pada Windows.

| Shortcut | Aksi |
| --- | --- |
| Cmd/Ctrl+O | Open Video |
| Cmd/Ctrl+Shift+O | Open ASS |
| Cmd/Ctrl+S | Save ASS |
| Cmd/Ctrl+Shift+S | Save As |
| Cmd/Ctrl+F | Search |
| Space | Play/pause |
| Left / Right | Seek −/+1 detik |
| Shift+Left / Shift+Right | Seek −/+100 ms |
| Home | Ke awal video |
| Cmd/Ctrl+Enter | Set Start baris aktif melalui kontrol langsung |
| Cmd/Ctrl+Shift+Enter | Set End baris aktif melalui kontrol langsung |
| Delete saat tabel fokus | Hapus baris terpilih |

Shortcut playback tidak mengambil alih input teks.

## Development dan pengujian

Gunakan **Node.js 22.12+** dan npm.

```sh
npm ci
npm run dev
```

`dev` membangun main/preload lalu membuka Electron. Perubahan main/preload memerlukan restart perintah dev. Vite melayani UI selama development; video pengguna dibaca melalui protokol lokal `media:`.

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
```

Tes mencakup parser/writer ASS, metadata dan Format khusus, warna, pencarian, seleksi, editing, timing, seek video lokal, serta Burn dengan audio dan pembatalan. Smoke test membutuhkan `ffmpeg` di PATH dan sesi desktop untuk menjalankan Electron; video sintetis, dialog mock, dan folder sementara dipakai agar file pengguna tetap utuh.

## Build dan release

```sh
npm run dist:mac          # DMG/ZIP Apple Silicon dan Intel; jalankan pada Mac
npm run dist:mac:arm64    # hanya Apple Silicon
npm run dist:mac:x64      # hanya Intel
npm run dist:win          # installer NSIS/ZIP Windows x64
npm run release:checksums
```

Paket berada di `release/` dan memakai versi dari `package.json`. Hook packaging menyertakan FFmpeg sesuai OS/arsitektur target beserta lisensi dan informasi sumber binary.

GitHub Actions menyediakan dua workflow manual:

1. **Build release packages** menjalankan tes dan build pada runner Windows/macOS, lalu menyimpan artifact.
Build Mac juga memeriksa signature aplikasi/FFmpeg dan integritas DMG sebelum menyimpan artifact.

2. **Publish verified release artifacts** menerima ID build yang berhasil dan tag draft release. Workflow memeriksa kecocokan commit, checksum seluruh paket, integritas ZIP, serta keberadaan FFmpeg dan lisensinya sebelum mengunggah paket dan menerbitkan release.

Untuk v0.1.1, 75 tes dan build berhasil di ketiga runner. Keenam paket, checksum, dan isi ZIP sudah diverifikasi sebelum publikasi. Burn juga diuji melalui aplikasi macOS arm64 yang dipaketkan. Pengujian interaktif pada perangkat Windows dan Mac Intel masih terbatas.

## Batasan

- Preview CSS mendukung formatting dasar, warna inline `\c`/`\1c`, reset warna, alignment, outline/shadow, serta escape ASS. Efek dan posisi inline kompleks tetap disimpan, tetapi preview belum merender semuanya.
- ASS disimpan dengan presisi centisecond (10 ms). Metadata, style, komentar, field tambahan, dan Format per Dialogue dipertahankan.
- Impor hanya mendukung ASS/SSA UTF-8. File dengan timing tidak valid ditolak.
- Undo/redo untuk perubahan subtitle, split/merge, global offset khusus, impor/ekspor SRT, impor ASR JSON, dan auto follow belum tersedia.
- Tabel belum divirtualisasi untuk file sangat besar. Ikon aplikasi masih memakai bawaan Electron.

Rancangan awal proyek tersedia di [seeds/seed01.md](seeds/seed01.md).

Jika macOS menolak aplikasi karena developer belum terverifikasi, coba buka aplikasi, lalu buka **System Settings → Privacy & Security → Open Anyway** untuk aplikasi yang Anda unduh dari release resmi. Jangan menonaktifkan Gatekeeper secara global. Release v0.1.2 memperbaiki signature bundle Mac yang tidak valid pada v0.1.1.
