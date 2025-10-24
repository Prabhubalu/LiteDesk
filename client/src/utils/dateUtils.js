// Date utility functions to replace moment.js

export const dateUtils = {
  // Format date as "MMMM D, YYYY"
  format(date, formatStr = 'MMMM D, YYYY') {
    const d = new Date(date);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const replacements = {
      'YYYY': d.getFullYear(),
      'MMMM': months[d.getMonth()],
      'MMM': monthsShort[d.getMonth()],
      'MM': String(d.getMonth() + 1).padStart(2, '0'),
      'DD': String(d.getDate()).padStart(2, '0'),
      'D': d.getDate(),
      'dddd': days[d.getDay()],
      'ddd': daysShort[d.getDay()],
      'HH': String(d.getHours()).padStart(2, '0'),
      'hh': String(d.getHours() % 12 || 12).padStart(2, '0'),
      'h': d.getHours() % 12 || 12,
      'mm': String(d.getMinutes()).padStart(2, '0'),
      'ss': String(d.getSeconds()).padStart(2, '0'),
      'A': d.getHours() >= 12 ? 'PM' : 'AM',
      'a': d.getHours() >= 12 ? 'pm' : 'am'
    };
    
    let result = formatStr;
    Object.keys(replacements).forEach(key => {
      result = result.replace(key, replacements[key]);
    });
    
    return result;
  },

  // Start of day
  startOf(date, unit) {
    const d = new Date(date);
    if (unit === 'day') {
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day;
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
    } else if (unit === 'month') {
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
    }
    return d;
  },

  // End of day
  endOf(date, unit) {
    const d = new Date(date);
    if (unit === 'day') {
      d.setHours(23, 59, 59, 999);
    } else if (unit === 'week') {
      const day = d.getDay();
      const diff = d.getDate() - day + 6;
      d.setDate(diff);
      d.setHours(23, 59, 59, 999);
    } else if (unit === 'month') {
      d.setMonth(d.getMonth() + 1);
      d.setDate(0);
      d.setHours(23, 59, 59, 999);
    }
    return d;
  },

  // Add time
  add(date, amount, unit) {
    const d = new Date(date);
    if (unit === 'day' || unit === 'days') {
      d.setDate(d.getDate() + amount);
    } else if (unit === 'week' || unit === 'weeks') {
      d.setDate(d.getDate() + (amount * 7));
    } else if (unit === 'month' || unit === 'months') {
      d.setMonth(d.getMonth() + amount);
    } else if (unit === 'year' || unit === 'years') {
      d.setFullYear(d.getFullYear() + amount);
    }
    return d;
  },

  // Subtract time
  subtract(date, amount, unit) {
    return dateUtils.add(date, -amount, unit);
  },

  // Check if same
  isSame(date1, date2, unit = 'day') {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    if (unit === 'day') {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    } else if (unit === 'month') {
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth();
    } else if (unit === 'year') {
      return d1.getFullYear() === d2.getFullYear();
    }
    return d1.getTime() === d2.getTime();
  },

  // Check if between
  isBetween(date, start, end, unit = 'day', inclusivity = '[]') {
    const d = new Date(date);
    const s = new Date(start);
    const e = new Date(end);
    
    if (unit === 'day') {
      const dateDay = dateUtils.startOf(d, 'day').getTime();
      const startDay = dateUtils.startOf(s, 'day').getTime();
      const endDay = dateUtils.startOf(e, 'day').getTime();
      
      if (inclusivity === '[]') {
        return dateDay >= startDay && dateDay <= endDay;
      } else if (inclusivity === '()') {
        return dateDay > startDay && dateDay < endDay;
      }
    }
    
    return d >= s && d <= e;
  },

  // Check if same or before
  isSameOrBefore(date1, date2, unit = 'day') {
    return dateUtils.isSame(date1, date2, unit) || new Date(date1) <= new Date(date2);
  },

  // Time ago
  fromNow(date) {
    const d = new Date(date);
    const now = new Date();
    const seconds = Math.floor((now - d) / 1000);
    
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  },

  // Clone date
  clone(date) {
    return new Date(date);
  },

  // Get day/month/year
  date(d) { return new Date(d).getDate(); },
  month(d) { return new Date(d).getMonth(); },
  year(d) { return new Date(d).getFullYear(); },
  day(d) { return new Date(d).getDay(); },
  hour(d) { return new Date(d).getHours(); },
  minute(d) { return new Date(d).getMinutes(); },

  // Duration difference
  duration(end, start) {
    const diff = new Date(end) - new Date(start);
    return {
      asMinutes: () => diff / (1000 * 60),
      asHours: () => diff / (1000 * 60 * 60),
      asDays: () => diff / (1000 * 60 * 60 * 24)
    };
  },

  // ISO format
  toISOString(date) {
    return new Date(date).toISOString();
  }
};

// Export as default for easy import
export default dateUtils;

