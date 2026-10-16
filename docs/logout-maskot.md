# Aset popup logout

Aset aplikasi: `public/mascot/logout.png`.
Dibuat dengan tool imagegen bawaan sebagai suntingan gambar yang diberikan pengguna; latar transparan alpha dipertahankan.

Prompt final:

> Use case: background-extraction. Edit target: supplied Matoer mascot waving goodbye beside an orange open door and right-arrow icon. Remove ONLY the baked-in gray/white checkerboard background, replacing it with actual alpha transparency. Preserve the exact mascot identity, batik headwrap, face, waving hand, black jacket with orange M logo, backpack, shoes, door and arrow, composition, 3D materials and warm colors. Keep all foreground objects complete, no cropping, no new text, no visual redesign. This will be a 260px illustration in an application logout dialog.

Animasi aplikasi memakai CSS pada ilustrasi utuh (melayang/berpamitan), bukan video atau gerak sendi tangan. Konfirmasi menampilkan Maturnuwun sebelum logout. prefers-reduced-motion mematikan animasi. Dialog native menjaga fokus keyboard, Escape/Batal menutup hanya sebelum proses logout. POS memeriksa online dan antrean IndexedDB sebelum animasi, lalu memeriksa ulang sebelum menghapus snapshot dan menjalankan server logout yang sudah ada.
