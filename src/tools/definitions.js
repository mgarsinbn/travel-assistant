/**
 * Tool definitions for Claude's tool_use API.
 * These are the actions Umfufu can take.
 */

const tools = [
  {
    name: 'authorize_calendar',
    description: 'Start Google OAuth flow to authorize calendar access for a user. Must be done before any calendar operations.',
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The email address to authorize Google Calendar access for',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming calendar events for a user within a date range.',
    input_schema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'The email address whose calendar to check',
        },
        start_date: {
          type: 'string',
          description: 'Start date/time in ISO 8601 format (e.g., 2026-03-28T09:00:00)',
        },
        end_date: {
          type: 'string',
          description: 'End date/time in ISO 8601 format',
        },
      },
      required: ['email'],
    },
  },
  {
    name: 'find_free_slots',
    description: 'Find available meeting slots across multiple calendars for a given date.',
    input_schema: {
      type: 'object',
      properties: {
        emails: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of email addresses to check availability for',
        },
        date: {
          type: 'string',
          description: 'The date to check (YYYY-MM-DD format)',
        },
        duration_minutes: {
          type: 'number',
          description: 'Desired meeting duration in minutes (default: 30)',
        },
      },
      required: ['emails', 'date'],
    },
  },
  {
    name: 'create_calendar_event',
    description: 'Create a new calendar event and send invites to attendees.',
    input_schema: {
      type: 'object',
      properties: {
        organizer_email: {
          type: 'string',
          description: 'Email of the person creating the event',
        },
        summary: {
          type: 'string',
          description: 'Event title',
        },
        description: {
          type: 'string',
          description: 'Event description or agenda',
        },
        start_time: {
          type: 'string',
          description: 'Start time in ISO 8601 (e.g., 2026-03-28T14:00:00-04:00)',
        },
        end_time: {
          type: 'string',
          description: 'End time in ISO 8601',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses',
        },
      },
      required: ['organizer_email', 'summary', 'start_time', 'end_time'],
    },
  },
  {
    name: 'search_delta_flights',
    description: 'Search for Delta Air Lines flights between two airports.',
    input_schema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Departure airport code (e.g., JFK, LAX, ATL)',
        },
        destination: {
          type: 'string',
          description: 'Arrival airport code',
        },
        depart_date: {
          type: 'string',
          description: 'Departure date (YYYY-MM-DD)',
        },
        return_date: {
          type: 'string',
          description: 'Return date for round trip (YYYY-MM-DD), omit for one-way',
        },
        passengers: {
          type: 'number',
          description: 'Number of passengers (default: 1)',
        },
      },
      required: ['origin', 'destination', 'depart_date'],
    },
  },
  {
    name: 'get_delta_booking_url',
    description: 'Generate a direct Delta.com URL to search and book a specific flight route.',
    input_schema: {
      type: 'object',
      properties: {
        origin: { type: 'string', description: 'Departure airport code' },
        destination: { type: 'string', description: 'Arrival airport code' },
        depart_date: { type: 'string', description: 'Departure date (YYYY-MM-DD)' },
        return_date: { type: 'string', description: 'Return date (YYYY-MM-DD), optional' },
      },
      required: ['origin', 'destination', 'depart_date'],
    },
  },
  {
    name: 'search_marriott_hotels',
    description: 'Search for Marriott hotels in a city for given dates.',
    input_schema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City or location to search (e.g., "New York, NY" or "Chicago")',
        },
        check_in: {
          type: 'string',
          description: 'Check-in date (YYYY-MM-DD)',
        },
        check_out: {
          type: 'string',
          description: 'Check-out date (YYYY-MM-DD)',
        },
        rooms: {
          type: 'number',
          description: 'Number of rooms (default: 1)',
        },
        guests: {
          type: 'number',
          description: 'Number of guests (default: 1)',
        },
      },
      required: ['city', 'check_in', 'check_out'],
    },
  },
  {
    name: 'get_marriott_booking_url',
    description: 'Generate a direct Marriott.com URL to search and book hotels.',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City or location' },
        check_in: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        check_out: { type: 'string', description: 'Check-out date (YYYY-MM-DD)' },
        rooms: { type: 'number' },
        guests: { type: 'number' },
      },
      required: ['city', 'check_in', 'check_out'],
    },
  },
];

module.exports = tools;
