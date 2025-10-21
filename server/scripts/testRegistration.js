// Test registration endpoint
const fetch = require('node-fetch');

async function testRegistration() {
    const testData = {
        organizationName: "Test Company",
        username: "Test User",
        email: "test@example.com",
        password: "password123",
        vertical: "Retail (Fashion, Electronics, Footwear, etc.)"
    };
    
    console.log('🧪 Testing registration endpoint...\n');
    console.log('Sending data:', JSON.stringify(testData, null, 2));
    
    try {
        const response = await fetch('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });
        
        const text = await response.text();
        console.log('\n📡 Response Status:', response.status);
        console.log('📄 Response Body:');
        
        try {
            const data = JSON.parse(text);
            console.log(JSON.stringify(data, null, 2));
            
            if (data.organization) {
                console.log('\n✅ Organization created successfully!');
                console.log('   - Name:', data.organization.name);
                console.log('   - ID:', data.organization._id);
            } else {
                console.log('\n❌ No organization in response!');
            }
        } catch (e) {
            console.log(text);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Server is not running!');
            console.log('   Start it with: cd server && node server.js');
        }
    }
}

testRegistration();

