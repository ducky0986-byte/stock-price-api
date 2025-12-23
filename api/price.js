export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step 1: 인증 토큰 받기
    const tokenResponse = await fetch(
      'https://openapivts.koreainvestment.com:29443/oauth2/tokenP',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          appkey: process.env.KIS_APP_KEY,      // 환경변수 사용
          appsecret: process.env.KIS_APP_SECRET,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Token request failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Step 2: 주가 정보 요청
    const stockCode = req.query.code || '418660'; // 기본값: 418660
    const priceResponse = await fetch(
      `https://openapivts.koreainvestment.com:29443/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stockCode}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'appkey': process.env.KIS_APP_KEY,
          'appsecret': process.env.KIS_APP_SECRET,
          'tr_id': 'FHKST01010100',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    if (!priceResponse.ok) {
      throw new Error('Price request failed');
    }

    const priceData = await priceResponse.json();
    const output = priceData.output || {};

    // Step 3: 응답 포맷팅
    res.status(200).json({
      price: parseInt(output.stck_prpr || 0),           // 현재가
      change: parseFloat(output.prdy_ctrt || 0),        // 등락률
      high: parseInt(output.stck_hgpr || 0),            // 고가
      low: parseInt(output.stck_lwpr || 0),             // 저가
      volume: parseInt(output.acml_vol || 0),           // 거래량
      timestamp: new Date().toISOString(),
      raw: output,
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message,
      price: 36620,  // 폴백 값
      change: 0,
    });
  }
}
