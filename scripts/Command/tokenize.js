/**
 * Splits a command's argument string into tokens on whitespace, treating a
 * double-quoted segment as a single token (quotes stripped, \" unescaped).
 *
 * tokenize('build "my house" 3') -> ['build', 'my house', '3']
 *
 * @param {string} input
 * @returns {string[]}
 */
function tokenize(input) {
    const tokens = [];
    let i = 0;
    const n = input.length;

    while (i < n) {
        while (i < n && /\s/.test(input[i])) i++;
        if (i >= n) break;

        if (input[i] === '"') {
            i++;
            let token = '';
            while (i < n && input[i] !== '"') {
                if (input[i] === '\\' && input[i + 1] === '"') {
                    token += '"';
                    i += 2;
                } else {
                    token += input[i];
                    i++;
                }
            }
            if (i >= n) throw new Error('Unterminated quoted argument.');
            i++; // skip closing quote
            tokens.push(token);
        } else {
            let token = '';
            while (i < n && !/\s/.test(input[i])) {
                token += input[i];
                i++;
            }
            tokens.push(token);
        }
    }

    return tokens;
}

export { tokenize };
