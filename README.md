# Mini ASS Editor

Editor subtitle ASS lokal untuk macOS. Implementasi saat ini mencakup **Fase 1** dari `seeds/seed01.md`.

## Menjalankan

Gunakan Node.js **22.12+** dan npm. Gunakan Node 22 atau lebih baru karena dependency Electron, tes, dan packaging membutuhkan versi tersebut.

```sh
npm install
npm run dev
```

`npm run dev` membangun main/preload lalu membuka jendela Electron. Vite hanya melayani kode aplikasi selama development; video pengguna dibaca melalui protokol lokal `media:` dengan token yang hanya dibuat dari dialog file. Tidak ada backend, database, atau layanan cloud. Perubahan main/preload membutuhkan restart perintah dev.

## Alur kerja

1. Pilih **Open Video** untuk MP4, MOV, atau WebM dengan codec yang didukung Chromium.
2. Pilih **Open ASS** untuk ASS/SSA UTF-8.
3. Klik baris subtitle untuk memilih dan seek ke waktu start.
4. Klik dua kali Start, End, Style, atau Text untuk mengedit. **Enter** menyimpan; **Escape** membatalkan. Editor Text berupa kotak multiline dengan word wrap dan tinggi otomatis; **Shift+Enter** menambah baris baru (disimpan sebagai `\N` pada ASS). Teks ASS seperti `\N`, `\h`, dan override tags tetap tersedia dalam editor.
5. Gunakan **Set Start**, **Set End**, atau tombol Shift (angka dalam milidetik). Timestamp tidak valid ditolak; overlap diperbolehkan.
6. **Save ASS** menyimpan ke file aktif; **Save As…** membuat salinan. Impor SSA disimpan sebagai ASS melalui dialog Save As.

Panel video/tabel dapat diubah ukurannya dengan menyeret garis pemisah. Playback menyediakan seek, volume, dan speed 0.5–2×. **Insert Line** menyisipkan subtitle kosong setelah baris terpilih (atau pada waktu video jika belum ada seleksi). Klik dua kali Text untuk mengisi teks. **Delete Line** menghapus semua baris terpilih dan memilih baris tetangga. Add tetap tersedia untuk menambah subtitle pada waktu video. Baris selalu diurutkan naik berdasarkan Start saat impor, perubahan timing, penambahan, dan Rearrange. Hasil simpan ASS juga mengikuti urutan tersebut; baris dengan Start yang sama mempertahankan urutan relatifnya. Seleksi tetap mengikuti ID baris saat posisinya berubah.

Dialog Open Video, Open ASS, dan Save As mengingat folder terakhir masing-masing setelah aplikasi ditutup. Riwayat disimpan lokal di folder userData Electron (`dialog-folders.json`). Cancel tidak mengganti folder; folder yang sudah dihapus dilewati. Save As mempertahankan nama file aktif sebagai saran nama dan membuka folder simpan terakhir.

Di setiap baris, tombol **Set Start** di kolom Start mengambil waktu video langsung ketika diklik (pause maupun play), tanpa seek atau mengubah seleksi. End baris tepat di atasnya menurut urutan tabel saat diklik diatur 10 ms sebelum Start baru. Jika Start baru melewati End baris aktif, End ikut digeser dengan durasi semula. Jika baris lain konflik dengan rentang baris yang diklik, Start baris tersebut dipindah ke 10 ms setelah End baris yang diklik, dengan durasinya tetap. Konflik lanjutan digeser berantai sampai ada celah. Baris atas yang tidak dapat dipendekkan dengan durasi valid juga dipindah ke sesudah baris yang diklik. Timing tidak valid ditolak tanpa perubahan parsial.

## Search subtitle

Kolom **Search** di atas tabel memfilter subtitle berdasarkan teks, tanpa membedakan huruf besar/kecil dan tanpa memperhitungkan tag ASS. **Cmd/Ctrl+F** memfokuskan pencarian; **Escape** atau tombol **×** menghapus filter. Jumlah hasil/total ditampilkan di atas tabel. Nomor baris tetap mengikuti urutan semua subtitle. Filter tidak mengubah file atau playback, dan Save tetap menyimpan seluruh subtitle. Seleksi baris tersembunyi dilepas saat filter berubah; Shift-klik memilih rentang yang terlihat.

## Rearrange timing lagu

Klik baris pertama lalu **Shift-klik** baris terakhir untuk memilih rentang. **Cmd-klik** (macOS) atau **Ctrl-klik** menambah/menghapus baris dari seleksi, termasuk baris yang tidak berurutan. Klik biasa memilih satu baris dan seek video; klik dengan modifier mempertahankan posisi video.

Klik **Rearrange** untuk langsung memakai **Baris terpilih**, dengan waktu mulai/akhir asal dan baru otomatis terisi. Jika tidak ada seleksi, cakupan awal adalah seluruh subtitle. Pilihan **Seluruh subtitle** dan **Rentang nomor baris** tetap tersedia. Isi waktu mulai/akhir baru. Nomor baris mengikuti tabel yang diurutkan berdasarkan Start saat dialog dibuka. Rentang asal otomatis mengambil Start paling awal dan End paling akhir pada pilihan; rentang ini juga bisa diubah asalkan mencakup semua baris yang dipilih.

Contoh baris 1–5: asal `00:30`–`04:30`, baru `00:45`–`03:30`. Klik **Apply Timing** untuk memetakan semua Start/End yang dipilih secara proporsional. Waktu `00:30` menjadi `00:45`, waktu `04:30` menjadi `03:30`; durasi dan jeda di antaranya menjadi 68.75% dari sebelumnya. Baris lain tetap sama. Format input menerima `MM:SS`, `MM:SS.mmm`, atau `HH:MM:SS.mmm`.

Teks, style, dan override tags tetap dipertahankan; waktu relatif di dalam tag karaoke/animasi ASS tidak dihitung ulang. Overlap tetap diperbolehkan. Rentang tidak valid atau durasi yang hilang saat disimpan pada presisi ASS ditolak tanpa menerapkan perubahan parsial. Perubahan belum memiliki undo history.

## Shortcut Fase 1

| Shortcut | Aksi |
| --- | --- |
| Cmd+O | Buka video |
| Cmd+Shift+O | Buka subtitle |
| Cmd+S / Cmd+Shift+S | Save / Save As |
| Space | Play/pause |
| Left / Right | Seek −/+1 detik |
| Shift+Left / Shift+Right | Seek −/+100 ms |
| Home | Ke awal |
| Cmd+Enter / Cmd+Shift+Enter | Set Start / End |
| Delete saat tabel fokus | Hapus baris terpilih |

Shortcut playback tidak mengambil alih input teks. Perubahan belum disimpan ditandai `*`; membuka subtitle lain atau menutup aplikasi menampilkan dialog native Save/Discard/Cancel.

## Verifikasi dan build

```sh
npm run typecheck
npm run test
npm run build
npm run test:smoke
npm run dist:mac
```

Tes unit mencakup urutan Format khusus, koma, Unicode, style, override tags, roundtrip, validasi timing, tambah/hapus, serta edit dan byte-range untuk seek video lokal. `test:smoke` membutuhkan `ffmpeg` di PATH dan sesi desktop macOS untuk menguji Electron dengan video sintetis dan dialog file yang diganti secara otomatis. File pengguna tidak dipakai oleh tes.

`dist:mac` menghasilkan `.app` unsigned untuk arsitektur mesin saat ini di `release/`. Signing tidak diperlukan untuk pengembangan lokal. Aplikasi unsigned yang dipindahkan/download dapat diblokir Gatekeeper; gunakan pengaturan Privacy & Security macOS untuk membuka aplikasi yang Anda percayai. Packaging Intel belum diuji.

## Batasan saat ini

- Preview CSS mendukung font, ukuran, warna BGR/inverted alpha, bold/italic, warna teks inline `\c`/`\1c` (BGR), reset warna `\c`/`\r`, alignment V4+, outline/shadow, dan escape dasar. Ini perkiraan, bukan renderer libass. Efek kompleks dan posisi inline tetap disimpan tetapi tidak dirender.
- Roundtrip mempertahankan bagian/metadata/style, field event tambahan, komentar, dan mapping Format tiap Dialogue. Dialogue disimpan berdasarkan Start; perubahan Format disisipkan seperlunya agar event lainnya tetap terbaca benar. Timestamp hasil simpan dibulatkan ke centisecond; durasi yang hilang akibat pembulatan ditolak.
- File malformed atau timing Dialogue yang tidak valid ditolak dengan nomor baris. Encoding selain UTF-8 belum didukung.
- Tabel belum divirtualisasi untuk file sangat besar.
- SRT/ASR JSON, split/merge/global offset (Fase 2), serta history undo/redo, auto follow (Fase 3) belum tersedia.
- Kompatibilitas output dengan IINA perlu diuji manual; IINA tidak tersedia pada lingkungan verifikasi ini.

## Status verifikasi Fase 1

TypeScript, 60 tes unit, smoke test pada Electron, drag slider saat playback, launch development, dan packaging `.app` arm64 berhasil diuji. Smoke test mengganti respons dialog untuk pengujian otomatis; pemilihan file melalui dialog native dan pembukaan output di IINA masih perlu diperiksa manual. `npm audit --omit=dev` bersih; audit lengkap masih melaporkan 7 temuan moderate pada rantai dependency packaging `electron-builder`.
