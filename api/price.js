export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const APP_KEY = process.env.KIS_APP_KEY;
    const APP_SECRET = process.env.KIS_APP_SECRET;
    const BASE_URL = 'https://openapi.koreainvestment.com:9443'; // 모의이면 openapivts로 통일

    if (!APP_KEY || !APP_SECRET) {
      throw new Error('KIS_APP_KEY 또는 KIS_APP_SECRET이 설정되지 않았습니다.');
    }

    // 1) 토큰 요청
    const tokenRes = await fetch(`${BASE_URL}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: APP_KEY,
        appsecret: APP_SECRET,
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      throw new Error(`Token request failed: ${tokenRes.status} ${tokenText}`);
    }

    let tokenJson;
    try {
      tokenJson = JSON.parse(tokenText);
    } catch (e) {
      throw new Error(`Token JSON parse error: ${tokenText}`);
    }

    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new Error(`Token missing access_token: ${tokenText}`);
    }

    // 2) 시세 요청
    const code = req.query.code || '418660';
    const priceRes = await fetch(
      `${BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          appkey: APP_KEY,
          appsecret: APP_SECRET,
          tr_id: 'FHKST01010100',
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    const priceText = await priceRes.text();
    if (!priceRes.ok) {
      throw new Error(`Price request failed: ${priceRes.status} ${priceText}`);
    }

    let priceJson;
    try {
      priceJson = JSON.parse(priceText);
    } catch (e) {
      throw new Error(`Price JSON parse error: ${priceText}`);
    }

    const o = priceJson.output || {};
    res.status(200).json({
      price: Number(o.stck_prpr || 0),
      change: Number(o.prdy_ctrt || 0),
      high: Number(o.stck_hgpr || 0),
      low: Number(o.stck_lwpr || 0),
      volume: Number(o.acml_vol || 0),
      raw: o,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message || String(err),
      price: 36620,
      change: 0,
    });
  }
}
