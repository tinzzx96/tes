const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars (0,O,1,I)

function randomCode(length) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

// Kode 4-karakter ditampilkan di HP siswa saat terkunci
function generateChallengeCode() {
  return randomCode(4);
}

// PIN 6-angka diberikan ke pengawas untuk membuka blokir
function generateUnlockPin() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

module.exports = { generateChallengeCode, generateUnlockPin };
