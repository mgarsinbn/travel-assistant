const puppeteer = require('puppeteer');
const config = require('../config');

/**
 * Marriott hotel search and booking service.
 * Uses Puppeteer to interact with marriott.com.
 *
 * NOTE: Like Delta, Marriott has bot detection. For production reliability,
 * consider hotel APIs like Amadeus Hotel Search, Booking.com Affiliate API,
 * or direct Marriott Developer Portal access.
 */

async function searchHotels({ city, checkIn, checkOut, rooms = 1, guests = 1 }) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const url = buildSearchUrl({ city, checkIn, checkOut, rooms, guests });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    await page.waitForSelector('[class*="hotel"], [class*="property"], [data-testid*="hotel"]', {
      timeout: 20000,
    }).catch(() => null);

    const hotels = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="property-card"], [class*="hotel-card"], [data-component*="hotel"]'
      );

      cards.forEach((card, i) => {
        if (i >= 10) return;
        const text = card.innerText;
        results.push({
          index: i + 1,
          summary: text.substring(0, 500).replace(/\n+/g, ' | '),
        });
      });

      if (results.length === 0) {
        return [{ index: 0, summary: document.body.innerText.substring(0, 2000) }];
      }
      return results;
    });

    await browser.close();
    return { success: true, hotels, url };
  } catch (err) {
    await browser.close();
    return {
      success: false,
      error: err.message,
      suggestion: 'Marriott\'s site may have blocked automated access. Use the direct URL to search manually.',
      url: buildSearchUrl({ city, checkIn, checkOut, rooms, guests }),
    };
  }
}

function buildSearchUrl({ city, checkIn, checkOut, rooms = 1, guests = 1 }) {
  const params = new URLSearchParams({
    destinationAddress: city,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfRooms: rooms.toString(),
    numberOfGuests: guests.toString(),
  });
  return `https://www.marriott.com/search/default.mi?${params}`;
}

module.exports = { searchHotels, buildSearchUrl };
