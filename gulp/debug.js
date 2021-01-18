"use strict";
const through = require("through2");

function transform(file, encoding, callback) {
	if(file.isNull()) return callback(null, file);
	if(file.isStream()) {
		console.log('Cannot use streamed files');
		return callback();
	}
	if(file.extname != ".htm") return callback(null, file);

	encoding = encoding || 'utf8'
	let content = file.contents.toString(encoding);

	// 變換基底
	content = content.replace('</title>', '</title>\n\t<base href="../dist/">');

	// 本地端測試檔案不加上的東西
	content = content.replace('<script async src="https://www.googletagmanager.com/gtag/js?id=G-GG1TEZGBCQ"></script>', "");
	content = content.replace('<link rel="manifest" href="manifest.json">', "");

	// 替換成偵錯版資源
	content = content.replace('lib/vue.runtime.min.js', '../debug/vue.runtime.js');
	content = content.replace('lib/paper-core.min.js', '../debug/paper-core.js');
	content = content.replace('shrewd.min.js', '../debug/shrewd.js');
	content = content.replace('bpstudio.js', '../debug/bpstudio.js');

	file.contents = Buffer.from(content, encoding);
	return callback(null, file);
}
function env() {
	return through.obj(transform);
}
module.exports = env;
