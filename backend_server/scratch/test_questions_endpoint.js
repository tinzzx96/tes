async function main() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nisn: '9900000001',
        password: 'siswa123',
        sessionToken: 'BF38EF',
        device_id: 'test-device-1'
      })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.success) {
      console.error('Login failed:', loginJson);
      return;
    }
    const token = loginJson.data.accessToken;
    console.log('Login success, token:', token);

    // 2. Validate Token
    const validateRes = await fetch('http://localhost:8000/api/exam-tokens/validate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({
        examId: 5,
        token: 'FBAD24'
      })
    });
    const validateJson = await validateRes.json();
    console.log('Validate token response:', validateJson);

    // 3. Start Exam
    const startRes = await fetch('http://localhost:8000/api/exams/5/start', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, 
        'x-device-id': 'test-device-1' 
      }
    });
    const startJson = await startRes.json();
    console.log('Start exam response:', startJson);

    // 4. Get Questions
    const questionsRes = await fetch('http://localhost:8000/api/exams/5/questions', {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${token}`, 
        'x-device-id': 'test-device-1' 
      }
    });
    const questionsJson = await questionsRes.json();
    console.log('Get questions response structure:', JSON.stringify(questionsJson, null, 2));

  } catch (e) {
    console.error('Error occurred:', e.message);
  }
}

main();
