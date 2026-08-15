/**
 * Built-in argument type parsers. Each parser takes one raw string token and
 * either returns the parsed value or throws an ArgumentParseError with a
 * player-facing message. These have no dependency on @minecraft/server, so
 * they can be unit tested with plain Node.js.
 *
 * More types (player, location) are handled directly in CommandRegistry.js
 * since they need access to world state. Custom types can be added at
 * runtime via registry.registerArgumentType(name, parseFn).
 */

class ArgumentParseError extends Error {}

const ArgumentTypes = {
    string: {
        parse(token) {
            return token;
        },
    },

    int: {
        parse(token) {
            const n = Number(token);
            if (!Number.isInteger(n)) {
                throw new ArgumentParseError(`"${token}" is not a whole number.`);
            }
            return n;
        },
    },

    float: {
        parse(token) {
            const n = Number(token);
            if (Number.isNaN(n)) {
                throw new ArgumentParseError(`"${token}" is not a number.`);
            }
            return n;
        },
    },

    boolean: {
        parse(token) {
            const t = token.toLowerCase();
            if (['true', 'yes', 'on', '1'].includes(t)) return true;
            if (['false', 'no', 'off', '0'].includes(t)) return false;
            throw new ArgumentParseError(`"${token}" must be true/false, yes/no, or on/off.`);
        },
    },
};

export { ArgumentTypes, ArgumentParseError };
