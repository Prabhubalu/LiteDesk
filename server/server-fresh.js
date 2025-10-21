// Fresh server startup - clears module cache
console.log('🔥 Clearing Node module cache...');
Object.keys(require.cache).forEach(key => {
    delete require.cache[key];
});

console.log('📂 Current directory:', __dirname);
console.log('🔄 Loading fresh server code...');

// Now load the actual server
require('./server.js');

