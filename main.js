// electron-touch-bar-stock-ticker/main.js

// See e.g. https://www.electronjs.org/docs/latest/api/touch-bar/

const path = require('path');

// const { from } =  require('rxjs');

const { app, BrowserWindow, nativeImage, net, TouchBar } = require('electron');

const { TouchBarButton, TouchBarLabel, TouchBarSpacer } = TouchBar;

// const { createYahooFinanceDetailsScraper } = require('thaw-data-sources');
// const { createHttpClient } = require('thaw-http-json-client-node');

const refreshInterval = 60; // seconds

const symbol = '^GSPC'; // The S&P 500 index

const touchBarEscapeItem = new TouchBarButton({
	backgroundColor: '#000000',
	// 'icon': nativeImage.createFromPath(path.join(__dirname, 'build/18x18@2x.png')).resize({
	// 	width: 16,
	// 	height: 16
	// }),
	icon: nativeImage.createFromPath(path.join(__dirname, 'favicon3.16x16.png')),
	iconPosition: 'center',
	click: () => {
		console.log('touchBarEscapeItem clicked');
		app.quit();
	}
});

const quoteInfoButton = new TouchBarButton({
	label: `??:??:?? : ${symbol} = ?`,
	backgroundColor: '#808080'
});

const updateCountdownLabel = new TouchBarLabel({
	label: 'updateCountdownLabel',
	// accessibilityLabel: 'accessibilityLabel',
	textColor: '#ffffff'
});

const touchBar = new TouchBar({
	items: [
		quoteInfoButton,
		new TouchBarSpacer({ size: 'small' }),
		// new TouchBarSpacer({ size: 'large' }),
		updateCountdownLabel
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
			// console.log('response:', response);
			console.log(`HTTP/${response.httpVersionMajor}.${response.httpVersionMinor} GET response: ${response.statusCode} ${(response.statusCode === 200) ? 'OK' : response.statusMessage}`);

			response.on('error', (error) => {
				console.log(`Response error: ${JSON.stringify(error)}`);
				reject(error);
			});

			response.setEncoding('utf8');

			let rawData = '';

			response.on('data', (chunk) => {
				// console.log('Http response event: data');
				rawData += chunk;
			});

			response.on('end', () => {
				// console.log('Http response event: end');
				// console.log('**** BEGIN rawData ****');
				// console.log(rawData);
				// console.log('**** END rawData ****');
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

		// console.log('Calling Http request.end()...');
		request.end();
	});
}

function getMarketQuoteField(responseBodyAsString, dataField) {
	// Yahoo-specific code
	const str1 = `data-field="${dataField}"`;
	const index1 = responseBodyAsString.indexOf(str1);

	if (index1 < 0) {
		console.error('Fsck. index1 < 0.');

		return undefined;
	}

	const index2 = responseBodyAsString.indexOf('>', index1);

	if (index2 < 0) {
		console.error('Fsck. index2 < 0.');

		return undefined;
	}

	const str2 = responseBodyAsString.substring(index1, index2);
	const regex2 = /value="([^"]*)"/;
	const matches2 = str2.match(regex2);

	if (!matches2 || !matches2[1]) {
		console.error('Fsck. No regex2 match.');

		return undefined;
	}

	// console.log('matches2[1] is', matches2[1]);

	const value = Math.round(100 * parseFloat(matches2[1])) / 100;

	// console.log(dataField, ': value is', typeof value, value);

	return value;
}

async function getMarketQuote() {
	// Yahoo-specific URL
	const url = `https://finance.yahoo.com/quote/${symbol}`;

	const responseBodyAsString = await createElectronHttpRequest(url);

	const value = getMarketQuoteField(responseBodyAsString, 'regularMarketPrice');
	const change = getMarketQuoteField(responseBodyAsString, 'regularMarketChange');
	const changePercent = getMarketQuoteField(responseBodyAsString, 'regularMarketChangePercent');

	return { value, change, changePercent };
}

function getLocalHhMmSs() {
	const date = new Date();

	const hh = ('0' + date.getHours()).slice(-2);
	const mm = ('0' + date.getMinutes()).slice(-2);
	// const ss = ('0' + date.getSeconds()).slice(-2);

	// return `${hh}:${mm}:${ss}`;
	return `${hh}:${mm}`;
}

function getAndDisplayMarketPrice() {
	const startTime = new Date();

	getMarketQuote().then((data) => {
		console.log(`The current price of ${symbol} is ${data.value} ${data.change} (${data.changePercent}%)`);

		const hhmmss = getLocalHhMmSs();
		let timeoutMs = refreshInterval * 1000 + (startTime - new Date());
		let fn = () => {
			quoteInfoButton.label = `${hhmmss} : ${symbol} = ${data.value}  ${data.change}  (${data.changePercent}%)`;
			updateCountdownLabel.label = `(next update in ${Math.floor(timeoutMs / 1000)}s)`;

			if (data.change > 0) {
				quoteInfoButton.backgroundColor = '#00c000';
			} else if (data.change < 0) {
				quoteInfoButton.backgroundColor = '#c00000';
			} else {
				quoteInfoButton.backgroundColor = '#808080';
			}

			if (timeoutMs < 1100) {
				setTimeout(getAndDisplayMarketPrice, timeoutMs);
			} else {
				timeoutMs -= 1000;
				setTimeout(fn, 1000);
			}
		};

		fn();
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
});
