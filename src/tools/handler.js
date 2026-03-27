const calendar = require('../services/calendar');
const delta = require('../services/delta');
const marriott = require('../services/marriott');

async function handleToolCall(name, input) {
  switch (name) {
    case 'authorize_calendar': {
      // Check if already authorized
      if (calendar.isAuthorized(input.email)) {
        return { success: true, message: `Calendar already connected for ${input.email}` };
      }
      // Return an auth URL for the user to click
      const authUrl = calendar.getAuthUrl(input.email);
      return {
        success: true,
        needs_user_action: true,
        message: `Calendar not yet connected for ${input.email}. The user needs to click this link to authorize: ${authUrl}`,
        auth_url: authUrl,
      };
    }

    case 'list_calendar_events': {
      const events = await calendar.listEvents(input.email, input.start_date, input.end_date);
      return {
        success: true,
        count: events.length,
        events: events.map(e => ({
          id: e.id,
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          attendees: (e.attendees || []).map(a => a.email),
          location: e.location,
          meetLink: e.hangoutLink,
        })),
      };
    }

    case 'find_free_slots': {
      const slots = await calendar.findFreeSlots(
        input.emails,
        input.date,
        input.duration_minutes || 30
      );
      return { success: true, available_slots: slots };
    }

    case 'create_calendar_event': {
      const event = await calendar.createEvent(input.organizer_email, {
        summary: input.summary,
        description: input.description,
        startTime: input.start_time,
        endTime: input.end_time,
        attendees: input.attendees,
      });
      return {
        success: true,
        event_id: event.id,
        link: event.htmlLink,
        meet_link: event.hangoutLink,
        message: `Event "${input.summary}" created`,
      };
    }

    case 'search_delta_flights':
      return await delta.searchFlights({
        origin: input.origin,
        destination: input.destination,
        departDate: input.depart_date,
        returnDate: input.return_date,
        passengers: input.passengers,
      });

    case 'get_delta_booking_url': {
      const url = await delta.buildBookingUrl({
        origin: input.origin,
        destination: input.destination,
        departDate: input.depart_date,
        returnDate: input.return_date,
      });
      return { success: true, url };
    }

    case 'search_marriott_hotels':
      return await marriott.searchHotels({
        city: input.city,
        checkIn: input.check_in,
        checkOut: input.check_out,
        rooms: input.rooms,
        guests: input.guests,
      });

    case 'get_marriott_booking_url': {
      const url = marriott.buildSearchUrl({
        city: input.city,
        checkIn: input.check_in,
        checkOut: input.check_out,
        rooms: input.rooms,
        guests: input.guests,
      });
      return { success: true, url };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { handleToolCall };
