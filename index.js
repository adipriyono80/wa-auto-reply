const express = require('express');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Inisiasi Express Server (penting untuk Render)
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot WhatsApp sedang berjalan...');
});

app.listen(port, () => {
    console.log(`Server HTTP berjalan di http://localhost:${port}`);
});

// Path ke file JSON
const faqPath = path.join(__dirname, 'data', 'faq.json');
const productPath = path.join(__dirname, 'data', 'products.json');
const multiAnswerPath = path.join(__dirname, 'data', 'jawaban.json');

// Load data
let faq = JSON.parse(fs.readFileSync(faqPath, 'utf-8'));
let products = JSON.parse(fs.readFileSync(productPath, 'utf-8'));
let multiAnswers = JSON.parse(fs.readFileSync(multiAnswerPath, 'utf-8'));

// Daftar nama produk
const productNames = Object.keys(products);

// Kata kunci tambahan
const catalogKeywords = ['list kue', 'lihat menu'];
const confirmOrderKeywords = ['saya mau', 'saya ingin', 'saya pesan'];

// Fungsi deteksi awal: "pesan X kotak"
function isInitialOrderQuery(text) {
    const regex = /pesan\s+(\d+)\s+kotak(?:\s+isi)?/i;
    return text.match(regex);
}

// Fungsi deteksi permintaan katalog
function isCatalogRequest(text) {
    return catalogKeywords.some(kata => new RegExp(`\\b${kata}\\b`, 'i').test(text));
}

// Fungsi deteksi konfirmasi pesanan lengkap
function isConfirmOrder(text) {
    return confirmOrderKeywords.some(kata => new RegExp(`^${kata}`, 'i').test(text));
}

// Proses pesanan lengkap dengan tambahan biaya kotak & air minum
function prosesPesananLengkap(pesan, jumlah) {
    const text = pesan.toLowerCase();

    let listPesan = [];
    let totalHarga = 0;

    // Cari semua produk di dalam pesan
    for (const produk of productNames) {
        const productName = produk.trim().toLowerCase();
        const regex = new RegExp(productName, 'gi');

        while (regex.test(text)) {
            const harga = products[produk].konsumen;
            totalHarga += jumlah * harga;
            listPesan.push(`${jumlah}x ${produk} @ Rp${harga.toLocaleString()}`);
            break; // Hanya hitung sekali per produk
        }
    }

    if (listPesan.length === 0) return null;

    // Tambahkan biaya kotak & air minum
    const biayaKotakPerItem = 1500;
    const biayaAirMinumPerItem = 500;

    totalHarga += jumlah * (biayaKotakPerItem + biayaAirMinumPerItem);

    listPesan.push(`${jumlah}x kotak @ Rp1,500`);
    listPesan.push(`${jumlah}x air minum @ Rp500`);

    // Hitung subtotal per kotak
    const subtotalPerKotak = totalHarga / jumlah;

    const pesanOngkir = "_*Harga belum termasuk ongkos kirim*_";

    return `${listPesan.join('\n')}\n\nSubtotal per kotak: Rp${subtotalPerKotak.toLocaleString()}\nJumlah kotak: ${jumlah}\nTotal keseluruhan: Rp${totalHarga.toLocaleString()}\n${pesanOngkir}`;
}

// Fungsi untuk deteksi pertanyaan jamak → jawaban tunggal
function getMultiAnswer(text) {
    for (const item of multiAnswers) {
        const found = item.pertanyaan.some(q => new RegExp(`\\b${q}\\b`, 'i').test(text));
        if (found) return item.jawaban;
    }
    return null;
}

// Inisiasi client WhatsApp
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('Scan QR Code berikut:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot WhatsApp siap digunakan!');
});

// Tangkap pesan masuk
client.on('message', async (msg) => {
    try {
        const text = msg.body.toLowerCase();
        const sender = msg.from;

        // Jawab FAQ Biasa
        if (faq[text]) {
            await client.sendMessage(sender, faq[text]);
            return;
        }

        // Jawab dari jawaban.json (pertanyaan jamak)
        const multiAnswer = getMultiAnswer(text);
        if (multiAnswer) {
            await client.sendMessage(sender, multiAnswer);
            return;
        }

        // Deteksi pesanan lengkap: "saya mau pesan 10 kotak isi roti, kopi, teh manis"
        const fullMatch = text.match(/pesan\s+(\d+)\s+kotak\s+isi\s+(.+)/i);
        if (fullMatch) {
            const jumlah = parseInt(fullMatch[1]);
            const pesanProduk = fullMatch[2];
            const hasilHitung = prosesPesananLengkap(pesanProduk, jumlah);
            if (hasilHitung) {
                await client.sendMessage(sender, hasilHitung);
                return;
            }
        }

        // Deteksi pesanan awal: "saya mau pesan 10 kotak"
        const initialMatch = isInitialOrderQuery(text);
        if (initialMatch && !text.includes("isi")) {
            const jumlah = parseInt(initialMatch[1]);
            const pesanAwal = `_ketik list kue_ untuk lihat katalog\natau tuliskan pilihan kue seperti:\nroti, kopi, teh manis`;
            await client.sendMessage(sender, pesanAwal);
            return;
        }

        // Jika pengguna tanya katalog kue
        if (isCatalogRequest(text)) {
            await client.sendMessage(sender, "Berikut katalog kue kami");
            return;
        }

        // Jika pengguna sudah menyebutkan pilihan kue setelah ditanya
        if (isConfirmOrder(text)) {
            const jumlahMatch = isInitialOrderQuery(text) || [null, '1'];
            const jumlah = parseInt(jumlahMatch[1]);

            // Ambil daftar produk dari pesan
            const regex = /(?:saya mau|saya ingin|saya pesan)\s+(.+)/i;
            const match = text.match(regex);
            if (!match) return;

            const pesanProduk = match[1].replace(/^dan/i, '').trim();
            const hasilHitung = prosesPesananLengkap(pesanProduk, jumlah);

            if (hasilHitung) {
                await client.sendMessage(sender, hasilHitung);
                return;
            }
        }

    } catch (err) {
        console.error("Error saat memproses pesan:", err);
        await client.sendMessage(msg.from, "Terjadi kesalahan. Silakan coba lagi.");
    }
});

// Jalankan bot
client.initialize();