/**
* A enhanced Map structure with additional utility methods.
* Can be made persistent 
* @extends {Map}
*/
class Enmap extends Map {

	constructor(iterable, options = {}) {
		if (!iterable || typeof iterable[Symbol.iterator] !== 'function') {
			options = iterable || {};
			iterable = null;
		}
		super(iterable);

		this.fetchAll = options.fetchAll !== undefined ? options.fetchAll : true;

		if (options.provider) {
			this.persistent = true;
			this.db = options.provider;
			this.db.fetchAll = this.fetchAll;
			this.ttl = options.ttl || false;
			this.defer = this.db.defer;
			this.db.init(this);
		}
	}

	/* GENERAL-USE METHODS & HELPERS */

	/**
	* Initialize multiple Enmaps easily.
	* @param {Array<string>} names Array of strings. Each array entry will create a separate enmap with that name.
	* @param {EnmapProvider} Provider Valid EnmapProvider object.
	* @param {Object} options Options object to pass to the provider. See provider documentation for its options.
	* @example
	* // Using local variables and the mongodb provider.
	* const Enmap = require('enmap');
	* const Provider = require('enmap-mongo');
	* const { settings, tags, blacklist } = Enmap.multi(['settings', 'tags', 'blacklist'], Provider, { url: "some connection URL here" });
	* 
	* // Attaching to an existing object (for instance some API's client)
	* const Enmap = require("enmap");
	* const Provider = require("enmap-mongo");
	* Object.assign(client, Enmap.multi(["settings", "tags", "blacklist"], Provider, { url: "some connection URL here" }));
	* 
	* @returns {Array<Map>} An array of initialized Enmaps.
	*/
	static multi(names, Provider, options = {}, fetchall) {
		if (!names.length || names.length < 1) {
			throw new Error('"names" argument must be an array of string names.');
		}
		if (!Provider) {
			throw new Error('Second argument must be a valid EnmapProvider.');
		}
		const returnvalue = {};
		for (const name of names) {
			const enmap = new Enmap({ fetchAll: fetchall, provider: new Provider(Object.assign(options, { name })) });
			returnvalue[name] = enmap;
		}
		return returnvalue;
	}

	/**
	* Fetches every key from the persistent enmap and loads them into the current enmap value.
	* @return {Map} The enmap containing all values.
	*/
	fetchEverything() {
		return this.db.fetchEverything();
	}

	/**
	* Force fetch one or more key values from the enmap. If the database has changed, that new value is used.
	* @param {string|number} keyOrKeys A single key or array of keys to force fetch from the enmap database.
	* @return {*|Map} A single value if requested, or a non-persistent enmap of keys if an array is requested.
	*/
	async fetch(keyOrKeys) {
		if (!Array.isArray(keyOrKeys)) {
			const value = await this.db.fetch(keyOrKeys);
			if(value != null && value.value != null) {
				super.set(keyOrKeys, value.value);
				return value.value;
			}
			if (this.db.documentTTL) {
				super.set(keyOrKeys, null);
			}
			return null;
		}
		for(let i = 0; i < keyOrKeys.length; i++) {
			const value = await this.db.fetch(keyOrKeys[i]);
			if(value != null && value.value != null) {
				super.set(keyOrKeys[i], value.value);
			}
		}
	}

	/* METHODS THAT SET THINGS IN ENMAP */

	/**
	* Set the value in Enmap.
	* @param {string|number} key Required. The key of the element to add to The Enmap. 
	* If the Enmap is persistent this value MUST be a string or number.
	* @param {*} val Required. The value of the element to add to The Enmap. 
	* If the Enmap is persistent this value MUST be stringifiable as JSON.
	* @example
	* enmap.set('simplevalue', 'this is a string');
	* enmap.set('isEnmapGreat', true);
	* enmap.set('TheAnswer', 42);
	* enmap.set('IhazObjects', { color: 'black', action: 'paint', desire: true });
	* @return {Map} The Enmap.
	*/
	set(key, val, ttl) {
		if (val === null) return;
		if (this.persistent) {
			this.db.set(key, val, ttl);
		}
		return super.set(key, val);
	}

	/* METHODS THAT GETS THINGS FROM ENMAP */

	/**
	* Retrieves a key from the enmap. If fetchAll is false, returns a promise.
	* @param {string|number} key The key to retrieve from the enmap.
	* @example
	* const myKeyValue = enmap.get("myKey");
	* console.log(myKeyValue);
	* @return {*|Promise<*>} The value or a promise containing the value.
	*/
	/*
	async get(key) {
		let value = null;
		if (this.has(key)) {
			value = super.get(key);
			value.__ttl = Date.now();
			return value;
		}
		if (this.fetchAll || !this.persistent) {
			return value;
		}
		value = await this.fetch(key);
		if (value != null) {
			value.__ttl = Date.now();
		}
		return value;
	}
	*/

	/* METHODS THAT DELETE THINGS FROM ENMAP */

	/**
	* Deletes a key in the Enmap.
	* @param {string|number} key Required. The key of the element to delete from The Enmap. 
	* @param {boolean} bulk Internal property used by the purge method.  
	*/
	delete(key) {
		if (this.persistent) {
			this.db.delete(key);
		}
		super.delete(key);
	}

	/**
	* Calls the `delete()` method on all items that have it.
	*/
	deleteAll() {
		if (this.persistent) {
			this.db.bulkDelete();
		}
		super.clear();
	}

	clear() { return this.deleteAll; }

	/*
	BELOW IS DISCORD.JS COLLECTION CODE
	Per notes in the LICENSE file, this project contains code from Amish Shah's Discord.js
	library. The code is from the Collections object, in discord.js version 11. 

	All below code is sourced from Collections.
	https://github.com/discordjs/discord.js/blob/stable/src/util/Collection.js
	*/

	/**
	* Creates an ordered array of the values of this Enmap.
	* The array will only be reconstructed if an item is added to or removed from the Enmap,
	* or if you change the length of the array itself. If you don't want this caching behaviour, 
	* use `Array.from(enmap.values())` instead.
	* @returns {Array}
	*/
	array() {
		return Array.from(this.values());
	}

	/**
	* Creates an ordered array of the keys of this Enmap
	* The array will only be reconstructed if an item is added to or removed from the Enmap, 
	* or if you change the length of the array itself. If you don't want this caching behaviour, 
	* use `Array.from(enmap.keys())` instead.
	* @returns {Array}
	*/
	keyArray() {
		return Array.from(this.keys());
	}

	/**
	* Obtains random value(s) from this Enmap. This relies on {@link Enmap#array}.
	* @param {number} [count] Number of values to obtain randomly
	* @returns {*|Array<*>} The single value if `count` is undefined,
	* or an array of values of `count` length
	*/
	random(count) {
		let arr = this.array();
		if (count === undefined) return arr[Math.floor(Math.random() * arr.length)];
		if (typeof count !== 'number') throw new TypeError('The count must be a number.');
		if (!Number.isInteger(count) || count < 1) throw new RangeError('The count must be an integer greater than 0.');
		if (arr.length === 0) return [];
		const rand = new Array(count);
		arr = arr.slice();
		for (let i = 0; i < count; i++) {
			rand[i] = [arr.splice(Math.floor(Math.random() * arr.length), 1)];
		}
		return rand;
	}

	/**
	* Obtains random key(s) from this Enmap. This relies on {@link Enmap#keyArray}
	* @param {number} [count] Number of keys to obtain randomly
	* @returns {*|Array<*>} The single key if `count` is undefined, 
	* or an array of keys of `count` length
	*/
	randomKey(count) {
		let arr = this.keyArray();
		if (count === undefined) return arr[Math.floor(Math.random() * arr.length)];
		if (typeof count !== 'number') throw new TypeError('The count must be a number.');
		if (!Number.isInteger(count) || count < 1) throw new RangeError('The count must be an integer greater than 0.');
		if (arr.length === 0) return [];
		const rand = new Array(count);
		arr = arr.slice();
		for (let i = 0; i < count; i++) {
			rand[i] = [arr.splice(Math.floor(Math.random() * arr.length), 1)];
		}
		return rand;
	}

	/**
	* Searches for all items where their specified property's value is identical to the given value
	* (`item[prop] === value`).
	* @param {string} prop The property to test against
	* @param {*} value The expected value
	* @returns {Array}
	* @example
	* enmap.findAll('username', 'Bob');
	*/
	findAll(prop, value) {
		if (typeof prop !== 'string') throw new TypeError('Key must be a string.');
		if (typeof value === 'undefined') throw new Error('Value must be specified.');
		const results = [];
		for (const item of this.values()) {
			if (item[prop] === value) results.push(item);
		}
		return results;
	}

	/**
	* Searches for a single item where its specified property's value is identical to the given value
	* (`item[prop] === value`), or the given function returns a truthy value. In the latter case, this is identical to
	* [Array.find()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find).
	* <warn>All Enmap used in Discord.js are mapped using their `id` property, and if you want to find by id you
	* should use the `get` method. See
	* [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get) for details.</warn>
	* @param {string|Function} propOrFn The property to test against, or the function to test with
	* @param {*} [value] The expected value - only applicable and required if using a property for the first argument
	* @returns {*}
	* @example
	* enmap.find('username', 'Bob');
	* @example
	* enmap.find(val => val.username === 'Bob');
	*/
	find(propOrFn, value) {
		if (typeof propOrFn === 'string') {
			if (typeof value === 'undefined') throw new Error('Value must be specified.');
			for (const item of this.values()) {
				if (item[propOrFn] === value) return item;
			}
			return null;
		} else if (typeof propOrFn === 'function') {
			for (const [key, val] of this) {
				if (propOrFn(val, key, this)) return val;
			}
			return null;
		}
		throw new Error('First argument must be a property string or a function.');
	}

	/* eslint-disable max-len */
	/**
	* Searches for the key of a single item where its specified property's value is identical to the given value
	* (`item[prop] === value`), or the given function returns a truthy value. In the latter case, this is identical to
	* [Array.findIndex()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex).
	* @param {string|Function} propOrFn The property to test against, or the function to test with
	* @param {*} [value] The expected value - only applicable and required if using a property for the first argument
	* @returns {*}
	* @example
	* enmap.findKey('username', 'Bob');
	* @example
	* enmap.findKey(val => val.username === 'Bob');
	*/
	/* eslint-enable max-len */
	findKey(propOrFn, value) {
		if (typeof propOrFn === 'string') {
			if (typeof value === 'undefined') throw new Error('Value must be specified.');
			for (const [key, val] of this) {
				if (val[propOrFn] === value) return key;
			}
			return null;
		} else if (typeof propOrFn === 'function') {
			for (const [key, val] of this) {
				if (propOrFn(val, key, this)) return key;
			}
			return null;
		}
		throw new Error('First argument must be a property string or a function.');
	}

	/**
	* Searches for the existence of a single item where its specified property's value is identical to the given value
	* (`item[prop] === value`).
	* <warn>Do not use this to check for an item by its ID. Instead, use `enmap.has(id)`. See
	* [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has) for details.</warn>
	* @param {string} prop The property to test against
	* @param {*} value The expected value
	* @returns {boolean}
	* @example
	* if (enmap.exists('username', 'Bob')) {
	*  console.log('user here!');
	* }
	*/
	exists(prop, value) {
		return Boolean(this.find(prop, value));
	}

	/**
	* Identical to
	* [Array.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter),
	* but returns a Enmap instead of an Array.
	* @param {Function} fn Function used to test (should return a boolean)
	* @param {Object} [thisArg] Value to use as `this` when executing function
	* @returns {Enmap}
	*/
	filter(fn, thisArg) {
		if (thisArg) fn = fn.bind(thisArg);
		const results = new Enmap();
		for (const [key, val] of this) {
			if (fn(val, key, this)) results.set(key, val);
		}
		return results;
	}

	/**
	* Identical to
	* [Array.filter()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter).
	* @param {Function} fn Function used to test (should return a boolean)
	* @param {Object} [thisArg] Value to use as `this` when executing function
	* @returns {Array}
	*/
	filterArray(fn, thisArg) {
		if (thisArg) fn = fn.bind(thisArg);
		const results = [];
		for (const [key, val] of this) {
			if (fn(val, key, this)) results.push(val);
		}
		return results;
	}

	/**
	* Identical to
	* [Array.map()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map).
	* @param {Function} fn Function that produces an element of the new array, taking three arguments
	* @param {*} [thisArg] Value to use as `this` when executing function
	* @returns {Array}
	*/
	map(fn, thisArg) {
		if (thisArg) fn = fn.bind(thisArg);
		const arr = new Array(this.size);
		let i = 0;
		for (const [key, val] of this) arr[i++] = fn(val, key, this);
		return arr;
	}

	/**
	* Identical to
	* [Array.some()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some).
	* @param {Function} fn Function used to test (should return a boolean)
	* @param {Object} [thisArg] Value to use as `this` when executing function
	* @returns {boolean}
	*/
	some(fn, thisArg) {
		if (thisArg) fn = fn.bind(thisArg);
		for (const [key, val] of this) {
			if (fn(val, key, this)) return true;
		}
		return false;
	}

	/**
	* Identical to
	* [Array.every()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every).
	* @param {Function} fn Function used to test (should return a boolean)
	* @param {Object} [thisArg] Value to use as `this` when executing function
	* @returns {boolean}
	*/
	every(fn, thisArg) {
		if (thisArg) fn = fn.bind(thisArg);
		for (const [key, val] of this) {
			if (!fn(val, key, this)) return false;
		}
		return true;
	}

	/**
	* Identical to
	* [Array.reduce()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce).
	* @param {Function} fn Function used to reduce, taking four arguments; `accumulator`, `currentValue`, `currentKey`,
	* and `enmap`
	* @param {*} [initialValue] Starting value for the accumulator
	* @returns {*}
	*/
	reduce(fn, initialValue) {
		let accumulator;
		if (typeof initialValue !== 'undefined') {
			accumulator = initialValue;
			for (const [key, val] of this) accumulator = fn(accumulator, val, key, this);
		} else {
			let first = true;
			for (const [key, val] of this) {
				if (first) {
					accumulator = val;
					first = false;
					continue;
				}
				accumulator = fn(accumulator, val, key, this);
			}
		}
		return accumulator;
	}

	/**
	* Creates an identical shallow copy of this Enmap.
	* @returns {Enmap}
	* @example const newColl = someColl.clone();
	*/
	clone() {
		return new this.constructor(this);
	}

	/**
	* Combines this Enmap with others into a new Enmap. None of the source Enmaps are modified.
	* @param {...Enmap} enmaps Enmaps to merge
	* @returns {Enmap}
	* @example const newColl = someColl.concat(someOtherColl, anotherColl, ohBoyAColl);
	*/
	concat(...enmaps) {
		const newColl = this.clone();
		for (const coll of enmaps) {
			for (const [key, val] of coll) newColl.set(key, val);
		}
		return newColl;
	}

	/**
	* Checks if this Enmap shares identical key-value pairings with another.
	* This is different to checking for equality using equal-signs, because
	* the Enmaps may be different objects, but contain the same data.
	* @param {Enmap} enmap Enmap to compare with
	* @returns {boolean} Whether the Enmaps have identical contents
	*/
	equals(enmap) {
		if (!enmap) return false;
		if (this === enmap) return true;
		if (this.size !== enmap.size) return false;
		return !this.find((value, key) => {
			const testVal = enmap.get(key);
			return testVal !== value || (testVal === undefined && !enmap.has(key));
		});
	}

}

module.exports = Enmap;

/**
* @external forEach
* @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach}
*/

/**
* @external keys
* @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys}
*/

/**
* @external values
* @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/values}
*/
