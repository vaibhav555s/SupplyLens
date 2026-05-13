const axios = require('axios');

async function test() {
    const token = process.env.APIFY_API_TOKEN;
    const url = `https://api.apify.com/v2/acts/parseforge~importyeti-scraper/run-sync-get-dataset-items?token=${token}&timeout=60`;
    
    try {
        console.log('Testing "Walmart"...');
        const resW = await axios.post(url, { q: 'Walmart', maxItems: 2 });
        console.log('Walmart Count:', Array.isArray(resW.data) ? resW.data.length : 'Not an array');

        console.log('Testing "Target"...');
        const resT = await axios.post(url, { q: 'Target', maxItems: 2 });
        console.log('Target Count:', Array.isArray(resT.data) ? resT.data.length : 'Not an array');
    } catch (err) {
        console.log('Error Status:', err.response ? err.response.status : 'No response');
        console.log('Error Data:', JSON.stringify(err.response ? err.response.data : err.message, null, 2));
    }
}

test();
