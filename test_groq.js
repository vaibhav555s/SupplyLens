const { httpPost } = require('./src/utils/http');
const config = require('./src/config');
async function test() {
    try {
        const res = await httpPost('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1000,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: 'You are a global supply chain trade expert. Output only valid JSON.'
                },
                {
                    role: 'user',
                    content: `Identify the top 6 most likely imported products (and their 6-digit HSN codes) for the company "Tesla". 
                Return ONLY a JSON object with a single key "hsnCodes" containing an array of objects.
                Each object must have exactly these keys: 
                "code" (string, the 6-digit HSN code like "8501.53"), 
                "description" (string, short product description), 
                "records" (number, a plausible, highly believable randomly generated number between 100 and 3000 representing shipment volume), 
                "countries" (array of exactly 3 country codes like ["JP", "TW", "CN"]), 
                "flags" (array of 3 emojis matching the countries),
                "icon" (a single relevant emoji for the product).`
                }
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${config.groqApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });
        console.log("SUCCESS");
    } catch (err) {
        console.error("FAIL", err.response?.data);
    }
}
test();
