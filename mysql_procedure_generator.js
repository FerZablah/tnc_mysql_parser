const fs = require('fs');
const generateJsProcedure = (path) => {
    return new Promise((resolve ,reject) => {
        console.log('path inside generate', path);
        fs.readFile(path, "utf-8", (err, data) => {
            if (err) {
                reject(err);
            }
            data = data.substring(data.indexOf("CREATE PROCEDURE") + 16);
            data = data.trimLeft();
            const methodName = data.substring(0, data.indexOf("(")).trim();
            let params = data.substring(methodName.length);
            params = params.substring(0, params.indexOf('BEGIN')).trim();
            params = params.substring(1, params.length - 1).trim();
            params = params.split(',');
    
            params.forEach((param, index) => {
                param.trimLeft();
                param = param.substring(param.indexOf('input_') + 6);
                let type = param;
                param = param.substring(0, param.indexOf(' ')).trimRight();
                type = type.substring(type.indexOf(' ')).trim();
                type = mysqlDataTypeToJs(type);
                params[index] = {
                    type,
                    param
                }
            });
            resolve(createJsFileStr(params, methodName));
        });
    });
}
const createJsFileStr = (params, name) => {
    let str = `let db;\n/**\n* ${name}\n* @summary Call to procedure ${name}\n`;
    params.forEach((param) => {
        str += `* @param {${param.type}} ${param.type === 'Moment' ? 'MomentObject_'+param.param : param.param}\n`
    });
    str += `* @return {Array} Returns array of results if procedure has a SELECT \n`
    str += `* @example\n*\n*\t${name}(`
    params.forEach((param) => {
        str += `${getDataTypeExample(param.type)}, `;
    });
    str = str.substring(0, str.length - 2);
    str += `)\n*/\n`;
    str += `\nconst ${name} = async (`;
    let strParams = '';
    params.forEach((param) => {
        strParams += `${param.type === 'Moment' ? 'MomentObject_'+param.param : param.param}, `;
    });
    strParams = strParams.substring(0, strParams.length - 2);
    str += strParams;
    str += `) => {\n   if(!db) db = require("tnc_mysql_connector");\n   return (await db.queryProcedure('${name}',${strParams}));\n}`;
    str += `\nmodule.exports = {\n   ${name}\n}`;
    return {name, str};
}

const getDataTypeExample = (type) => {
    switch (type) {
        case 'Number':
            return '1';
        case 'Boolean':
            return 'true';
        case 'Moment':
            return 'new Moment.utc()';
        case 'String':
            return `'stringExample'`;
        default:
            return '';
    }
}

const mysqlDataTypeToJs = (str) => {
    if (str.includes('INT') || str.includes('DOUBLE') || str.includes('FLOAT') || str.includes('DECIMAL')) return 'Number';
    if (str.includes('BIT')) return 'Boolean';
    if (str.includes('DATE')) return 'Moment';
    if (str.includes('CHAR') || str.includes('TEXT') || str.includes('ENUM')) return 'String';
    else return '';
}

module.exports = generateJsProcedure;