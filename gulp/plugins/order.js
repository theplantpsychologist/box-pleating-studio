const through2 = require("gulp-through2");

// For sorting the locale file entries to the same ordering as the source locale

function copyInOrderOf(source, order) {
	if(typeof source != "object" || Array.isArray(source)) return source;
	const result = {};
	for(const key in order) result[key] = copyInOrderOf(source[key], order[key]);
	return result;
}

module.exports = function(sourceName) {
	let source;
	return through2({
		name: "locale-order",
		filter: ".json",
		transform(_, file) {
			if(file.basename == sourceName) {
				source = file;
				return null;
			}
		},
		flush(files) {
			if(!source) return;
			this.push(source);
			source = JSON.parse(through2.read(source));
			for(const file of files) {
				const json = JSON.parse(through2.read(file));
				const result = JSON.stringify(copyInOrderOf(json, source), null, "\t") + "\n";
				through2.write(file, result);
			}
		},
	});
};
