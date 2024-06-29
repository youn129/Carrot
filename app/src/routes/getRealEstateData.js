const express = require('express');
const router = express.Router();
const axios = require('axios');
require('dotenv').config();
const seoulDistrictCodes = require('../data/seoulDistrictCodes.js');


const today = new Date();
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(today.getMonth() - 6);

const startYearMonth = `${sixMonthsAgo.getFullYear()}${('0' + (sixMonthsAgo.getMonth() + 1)).slice(-2)}`;



const fetchRealEstateData = async (districtCode) => {
    const url = process.env.REAL_ESTATE_API_URL;;
    const serviceKey = process.env.REAL_ESTATE_API_KEY;
    const queryParams = `?serviceKey=${serviceKey}&LAWD_CD=${districtCode}&DEAL_YMD=${startYearMonth}`;
    const response = await axios.get(url + queryParams);
    return response.data.response.body.items.item;
};

router.get('/detailRealEstate', async (req, res) => {
    const { codes } = req.query;
    if (!codes) {
        return res.status(400).json({ error: 'No district codes provided' });
    }

    try {
        const codesArray = codes.split(',');
        const data = await Promise.all(codesArray.map(code => fetchRealEstateData(code)));
        res.json(data.flat()); // 데이터를 평탄화하여 반환
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

router.get('/sse', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let index = 0;

    const interval = setInterval(async () => {
        if (index < seoulDistrictCodes.length) {
            const district = seoulDistrictCodes[index];
            try {
                const data = await fetchRealEstateData(district.code);
                res.write(`data: ${JSON.stringify(data[0] || {})}\n\n`);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
            index++;
        } else {
            clearInterval(interval);
            res.end();
        }
    }, 8000);

    req.on('close', () => {
        console.log('Connection closed.');
        clearInterval(interval);
        res.end();
    });
});

module.exports = { router };
