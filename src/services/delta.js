const puppeteer = require('puppeteer');
const config = require('../config');

/**
 * Delta flight search and booking service.
 * Uses Puppeteer to interact with delta.com since there's no public API.
 *
 * NOTE: This is a foundation — Delta's site has bot detection and frequent
 * layout changes. For production use, consider a travel API like Amadeus,
 * Sabre, or Travelport for reliable GDS access.
 */

async function searchFlights({ origin, destination, departDate, returnDate, passengers = 1 }) {
  const browser = await puppeteer.launch({ headless: false }); // visible for debugging
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Build Delta search URL
    const params = new URLSearchParams({
      cacheKeySuffix: Date.now().toString(),
      action: 'findFlights',
      tripType: returnDate ? 'roundTrip' : 'oneWay',
      departureDate: departDate,
      returnDate: returnDate || '',
      numOfPassengers: passengers.toString(),
      departureAirportCode: origin,
      arrivalAirportCode: destination,
    });

    const url = `https://www.delta.com/flight-search/search?${params}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for results to load
    await page.waitForSelector('[class*="flight"], [class*="result"], .flightCardContainer', {
      timeout: 20000,
    }).catch(() => null);

    // Scrape visible flight data
    const flights = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll(
        '[class*="flightCard"], [class*="flight-card"], [data-testid*="flight"]'
      );

      cards.forEach((card, i) => {
        if (i >= 10) return; // cap at 10 results
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
    return { success: true, flights, url };
  } catch (err) {
    await browser.close();
    return {
      success: false,
      error: err.message,
      suggestion: 'Delta\'s site may have blocked automated access. Try using the direct URL to search manually.',
      url: `https://www.delta.com/flight-search/book-a-flight?departureDate=${departDate}&departureAirportCode=${origin}&arrivalAirportCode=${destination}`,
    };
  }
}

async function buildBookingUrl({ origin, destination, departDate, returnDate }) {
  const params = new URLSearchParams({
    action: 'findFlights',
    tripType: returnDate ? 'roundTrip' : 'oneWay',
    departureDate: departDate,
    returnDate: returnDate || '',
    departureAirportCode: origin.toUpperCase(),
    arrivalAirportCode: destination.toUpperCase(),
    numOfPassengers: '1',
  });

  return `https://www.delta.com/flight-search/book-a-flight?${params}`;
}

module.exports = { searchFlights, buildBookingUrl };
