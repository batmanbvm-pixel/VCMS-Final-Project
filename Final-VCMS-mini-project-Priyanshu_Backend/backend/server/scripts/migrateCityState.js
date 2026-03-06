/**
 * Migration Script: Populate city and state fields from location
 * Run this once to migrate existing doctor data
 * Command: node scripts/migrateCityState.js
 */

const dotenv = require('dotenv');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

// City to State mapping for Indian cities
const cityToState = {
  'Mumbai': 'Maharashtra',
  'Delhi': 'Delhi',
  'Bangalore': 'Karnataka',
  'Chennai': 'Tamil Nadu',
  'Hyderabad': 'Telangana',
  'Pune': 'Maharashtra',
  'Kolkata': 'West Bengal',
  'Ahmedabad': 'Gujarat',
  'Jaipur': 'Rajasthan',
  'Surat': 'Gujarat',
  'Lucknow': 'Uttar Pradesh',
  'Kanpur': 'Uttar Pradesh',
  'Nagpur': 'Maharashtra',
  'Indore': 'Madhya Pradesh',
  'Thane': 'Maharashtra',
  'Bhopal': 'Madhya Pradesh',
  'Visakhapatnam': 'Andhra Pradesh',
  'Pimpri': 'Maharashtra',
  'Patna': 'Bihar',
  'Vadodara': 'Gujarat',
  'Ghaziabad': 'Uttar Pradesh',
  'Ludhiana': 'Punjab',
  'Agra': 'Uttar Pradesh',
  'Nashik': 'Maharashtra',
  'Faridabad': 'Haryana',
  'Meerut': 'Uttar Pradesh',
  'Rajkot': 'Gujarat',
  'Kalyan': 'Maharashtra',
  'Vasai': 'Maharashtra',
  'Varanasi': 'Uttar Pradesh',
};

// List of valid Indian states (for checking if parsed state is actually a state)
const validStates = new Set([
  'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'West Bengal',
  'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'Andhra Pradesh',
  'Bihar', 'Haryana', 'Punjab', 'Assam', 'Odisha', 'Kerala', 'Jharkhand',
  'Chhattisgarh', 'Uttarakhand', 'Goa', 'Himachal Pradesh', 'Tripura',
  'Meghalaya', 'Manipur', 'Nagaland', 'Sikkim', 'Mizoram', 'Arunachal Pradesh',
]);

// Helper function to find state for city (case-insensitive)
function findStateForCity(cityName) {
  const normalizedCity = cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase();
  return cityToState[normalizedCity] || '';
}

const migrate = async () => {
  try {
    await connectDB();

    const doctors = await User.find({ role: 'doctor' });

    let migrated = 0;
    let skipped = 0;

    for (const doctor of doctors) {
      // Skip if city and state already populated
      if (doctor.city && doctor.state) {
        skipped++;
        continue;
      }

      const location = doctor.location || '';
      const parts = location.split(',').map(s => s.trim()).filter(Boolean);
      
      let city = '';
      let state = '';
      
      if (parts.length === 1) {
        // Single value - check if it's a known city
        city = parts[0];
        state = findStateForCity(city);
      } else if (parts.length >= 2) {
        // Multiple values - check if last part is a valid state
        const potentialState = parts[parts.length - 1];
        
        if (validStates.has(potentialState) || validStates.has(potentialState.charAt(0).toUpperCase() + potentialState.slice(1).toLowerCase())) {
          // Last part is a valid state
          state = potentialState;
          city = parts.slice(0, -1).join(', ');
        } else {
          // Last part is not a state, treat first part as city
          city = parts[0];
          // Try to find state for the city
          state = findStateForCity(city);
        }
      }
      
      // Final fallback: if we have city but no state, try mapping
      if (city && !state) {
        state = findStateForCity(city);
      }
      
      if (city || state) {
        await User.findByIdAndUpdate(doctor._id, { city, state });
        migrated++;
      }
    }

    void migrated;
    void skipped;
    void doctors;
    
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
};

migrate();
