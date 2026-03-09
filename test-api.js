const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testEmptyKey() {
    const genAI = new GoogleGenerativeAI('');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    try {
        await model.generateContent("hello");
    } catch (e) {
        console.error("Empty key error:", e.message);
    }
}

testEmptyKey();
