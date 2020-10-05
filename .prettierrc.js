module.exports = {
    ...require('gts/.prettierrc.json'),
    tabWidth: 4,
    bracketSpacing: true,
    printWidth: 200,
    arrowParens: 'always',
    overrides: [
        {
            files: '*.json',
            options: {
                tabWidth: 2,
            },
        },
    ],
};
