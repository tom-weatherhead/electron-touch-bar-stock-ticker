// electron-touch-bar-stock-ticker/main.js

// See e.g. https://www.electronjs.org/docs/latest/api/touch-bar/

const path = require('path');

const { app, BrowserWindow, nativeImage, TouchBar } = require('electron');

const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

const { createYahooFinanceDetailsScraper } = require('thaw-data-sources');
const { createHttpClient } = require('thaw-http-json-client-node');

const scraper = createYahooFinanceDetailsScraper(createHttpClient());

const symbol = '^GSPC'; // The S&P 500 index

let spinning = false;

// Reel labels
const reel1 = new TouchBarLabel();
const reel2 = new TouchBarLabel();
const reel3 = new TouchBarLabel();

// Spin result label
const result = new TouchBarLabel();

// Spin button
const spin = new TouchBarButton({
	label: '🎰 Spin',
	backgroundColor: '#7851A9',
	click: () => {
		// Ignore clicks if already spinning
		if (spinning) {
			return;
		}

		spinning = true;
		result.label = '';

		let timeout = 10;
		const spinLength = 4 * 1000; // 4 seconds
		const startTime = Date.now();

		const spinReels = () => {
			updateReels();

			if (Date.now() - startTime >= spinLength) {
				finishSpin();
			} else {
				// Slow down a bit on each spin
				timeout *= 1.1;
				setTimeout(spinReels, timeout);
			}
		};

		spinReels();
	}
});

const getRandomValue = () => {
	// const values = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
	const values = ['🍒', '💎', '7️⃣', '🍊', '🔔', '⭐', '🍇', '🍀'];

	return values[Math.floor(Math.random() * values.length)];
};

const updateReels = () => {
	reel1.label = getRandomValue();
	reel2.label = getRandomValue();
	reel3.label = getRandomValue();
};

const finishSpin = () => {
	const uniqueValues = new Set([reel1.label, reel2.label, reel3.label]).size;

	if (uniqueValues === 1) {
		// All 3 values are the same
		result.label = '💰 Jackpot!!';
		result.textColor = '#FDFF00';
	} else if (uniqueValues === 2) {
		// 2 values are the same
		result.label = '😍 Winner!';
		result.textColor = '#FDFF00';
	} else {
		// No values are the same
		result.label = 'Spin Again';
		result.textColor = null;
	}

	spinning = false;
};

// BEGIN From https://stackoverflow.com/questions/48922997/touchbar-icon-with-custom-image-doesnt-load-in-electron
// const {nativeImage} = require('electron');
const touchBarEscapeItem = new TouchBarButton({
	'backgroundColor': '#000000',
	// 'icon': nativeImage.createFromPath(path.join(__dirname, 'build/18x18@2x.png')).resize({
	// 	width: 16,
	// 	height: 16
	// }),
	'icon': nativeImage.createFromPath(path.join(__dirname, 'favicon3.16x16.png')),
	'iconPosition': 'center',
	click: () => {
		console.log('touchBarEscapeItem clicked');
		app.quit();
	}
});
// END From https://stackoverflow.com/questions/48922997/touchbar-icon-with-custom-image-doesnt-load-in-electron

const quoteInfoLabel = new TouchBarLabel({
	label: `${symbol} : ?`,
	textColor: '#FDFF00'
});

const touchBar = new TouchBar({
	items: [
		spin,
		new TouchBarSpacer({ size: 'large' }),
		reel1,
		new TouchBarSpacer({ size: 'small' }),
		reel2,
		new TouchBarSpacer({ size: 'small' }),
		reel3,
		new TouchBarSpacer({ size: 'large' }),
		result,
		new TouchBarSpacer({ size: 'large' }),
		quoteInfoLabel
	],
	escapeItem: touchBarEscapeItem
});

async function getMarketQuote(){
	const result = await scraper.getData({ symbol }).toPromise();

	if (typeof result === 'undefined') {
		console.error('getMarketQuote() : Result from scraper is undefined.');

		return NaN;
	}

	return result.price.regularMarketPrice.raw;
}

let window;

// app.once('ready', () => {
app.whenReady().then(() => {
	window = new BrowserWindow({
		frame: false,
		titleBarStyle: 'hiddenInset',
		width: 200,
		height: 200,
		backgroundColor: '#000'
		// , show: false
	});
	window.loadURL('about:blank');
	window.setTouchBar(touchBar);

	return getMarketQuote();
}).then((price) => {
	console.log(`The current price of ${symbol} is ${price}`);
	quoteInfoLabel.label = `${symbol} : ${price}`;
});
