export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { namaToko, platform, namaProduk, deskripsi, target, images } = req.body;

  if (!namaToko || !namaProduk) {
    return res.status(400).json({ error: 'Nama toko dan produk wajib diisi' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan' });

  const systemPrompt = `Kamu adalah pakar e-commerce Indonesia yang jujur, tajam, dan sedikit humoris. Tugas kamu: roasting toko online dengan analisis yang konstruktif dan actionable. Selalu jawab dalam Bahasa Indonesia. WAJIB balas HANYA dengan JSON valid, tanpa preamble, tanpa backtick markdown.

Format JSON yang harus dikembalikan:
{
  "skor_foto": 0-100,
  "skor_copywriting": 0-100,
  "skor_harga": 0-100,
  "skor_overall": 0-100,
  "roasting_pembuka": "kalimat pembuka yang jujur dan sedikit pedas tapi membangun, 2-3 kalimat",
  "masalah_foto": "analisis foto produk, jujur dan spesifik, 3-4 poin dengan bullet •",
  "masalah_copywriting": "analisis judul dan deskripsi produk, 3-4 poin dengan bullet •",
  "masalah_harga": "analisis strategi harga dan positioning, 2-3 poin dengan bullet •",
  "rekomendasi_prioritas": "3 hal yang HARUS diperbaiki minggu ini, dengan bullet •",
  "kalimat_penutup": "kalimat penutup yang memotivasi, 1-2 kalimat"
}`;

  const userText = `Data toko:\nNama toko: ${namaToko}\nPlatform: ${platform}\nProduk: ${namaProduk}\nDeskripsi: ${deskripsi || '(tidak diisi)'}\nTarget pembeli: ${target || '(tidak diisi)'}\n\nAnalisis semua data di atas${images && images.length > 0 ? ' beserta foto produk yang dilampirkan' : ' (tidak ada foto, berikan masukan umum soal foto)'}. Balas HANYA JSON.`;

  const parts = [];

  if (images && images.length > 0) {
    images.forEach(img => {
      const base64Data = img.replace(/^data:image\/(jpeg|png|webp|gif);base64,/, '');
      const mimeType = img.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
      parts.push({ inline_data: { mime_type: mimeType, data: base64Data } });
    });
  }

  parts.push({ text: systemPrompt + '\n\n' + userText });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: geminiData.error?.message || 'Gemini API error' });
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'Gagal parse response AI', raw: text });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
