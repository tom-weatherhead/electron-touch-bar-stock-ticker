// electron-touch-bar-stock-ticker/main.js

// See e.g. https://www.electronjs.org/docs/latest/api/touch-bar/

const path = require('path');

const { from } =  require('rxjs');

const { app, BrowserWindow, nativeImage, net, TouchBar } = require('electron');

const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

const { createYahooFinanceDetailsScraper } = require('thaw-data-sources');
// const { createHttpClient } = require('thaw-http-json-client-node');

const refreshInterval = 60; // seconds

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

function createElectronHttpRequest(url) {
	return new Promise((resolve, reject) => {
		// const request = net.request({
		// 	method: 'GET',
		// 	protocol: 'https:',
		// 	hostname: 'github.com',
		// 	port: 443,
		// 	path: '/'
		// });

		// typeof request is ClientRequest
		// See https://www.electronjs.org/docs/latest/api/client-request
		const request = net.request(url);

		request.on('response', (response) => {
			// typeof response is IncomingMessage
			// See https://www.electronjs.org/docs/latest/api/incoming-message
			console.log('response:', response);
			console.log(`STATUS: ${response.statusCode}`);

			response.on('error', (error) => {
				console.log(`Response error: ${JSON.stringify(error)}`);
				reject(error);
			});

			response.setEncoding('utf8');

			let rawData = '';

			response.on('data', (chunk) => {
				console.log('Http response event: data');
				rawData += chunk;
			});

			response.on('end', () => {
				console.log('Http response event: end');
				resolve(rawData);
			});
		});

		request.on('error', (error) => {
			console.log(`Request error: ${JSON.stringify(error)}`);
			reject(error);
		});

		// request.on('finish', () => {
		// 	console.log('Http request event: finish');
		// });
		//
		// request.on('close', () => {
		// 	console.log('Http request event: close');
		// });

		console.log('Calling Http request.end()...');
		request.end();
	});
}

function createElectronHttpClient() {
	// The returned object implements the IHttpClient interface

	// export interface IHttpClient {
	// 	get(url: string): Observable<string>;
	// }

	return {
		get: (url) => from(createElectronHttpRequest(url))
	};
}

const scraper = createYahooFinanceDetailsScraper(
	// createHttpClient()
	createElectronHttpClient()
);

async function getMarketQuote(){
	const result = await scraper.getData({ symbol }).toPromise();

	if (typeof result === 'undefined') {
		console.error('getMarketQuote() : Result from scraper is undefined.');

		return NaN;
	}

	return result.price.regularMarketPrice.raw;
}

function getLocalHhMmSs() {
	const date = new Date();

	const hh = ('0' + date.getHours()).slice(-2);
	const mm = ('0' + date.getMinutes()).slice(-2);
	const ss = ('0' + date.getSeconds()).slice(-2);

	return `${hh}:${mm}:${ss}`;
}

function getAndDisplayMarketPrice() {
	const startTime = new Date();

	getMarketQuote().then((price) => {
		console.log(`The current price of ${symbol} is ${price}`);
		quoteInfoLabel.label = `${getLocalHhMmSs()} : ${symbol} = ${price}`;
		setTimeout(getAndDisplayMarketPrice, refreshInterval * 1000 + (startTime - new Date()));
	}).catch((error) => {
		console.error('getMarketQuote error:', error);
	});
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
	getAndDisplayMarketPrice();

// 	return getMarketQuote();
// }).then((price) => {
// 	console.log(`The current price of ${symbol} is ${price}`);
// 	quoteInfoLabel.label = `${getLocalHhMmSs()} : ${symbol} = ${price}`;
});
