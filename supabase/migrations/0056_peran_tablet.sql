-- nilai enum terpisah (tidak bisa dipakai dalam transaksi yang sama dengan pembuatannya)
alter type peran add value if not exists 'tablet';
