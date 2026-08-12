const inputForm = document.getElementById('input-form');
const xInput = document.getElementById('x-input');
const predictButton = document.getElementById('predict-button');
const outputDiv = document.getElementById('output');

// Define the ML model parameters
const m = 2; // slope
const c = 3; // intercept

predictButton.addEventListener('click', (e) => {
    e.preventDefault();
    const xValue = parseFloat(xInput.value);
    if (!isNaN(xValue)) {
        const predictedValue = m * xValue + c;
        outputDiv.innerHTML = `Predicted value: ${predictedValue.toFixed(2)}`;
    } else {
        outputDiv.innerHTML = 'Invalid input';
    }
});
