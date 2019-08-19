#!/usr/bin/env node
const fs = require("fs");
const generateJs = require('./mysql_procedure_generator');
const simpleGit = require('simple-git/promise')();
const chalk = require('chalk');
const _ = require('lodash');
const path = require('path');
let appDir = path.dirname(require.main.filename);
appDir = appDir.substring(0, appDir.lastIndexOf('Express'));
let promises = [];
let indexJSON;

const renamePath = (path) => {
    return (appDir + path).replace(/\\/g,"/");
}
const isProcedureFile = (path) => {
    return(
        path.substring(path.length - 3, path.length) === 'sql' &&
        path.substring(path.lastIndexOf('/') - 10, path.lastIndexOf('/')) === 'Procedures'
    );

}
async function main() {
    try {
        console.log('Running git analyzer on', appDir);
        promises = [];
        const originalIndexJSON = JSON.parse(fs.readFileSync(renamePath('Express/proceduresMethods/index.json')));
        indexJSON = _.cloneDeep(originalIndexJSON);
        const res = await simpleGit.status();
        console.log('Modified:', res.modified);
        console.log('Deleted:', res.deleted);
        console.log('created:', res.created); 
        console.log('renamed:', res.renamed);
        res.modified.forEach((file) => {
            file = renamePath(file);
            if (isProcedureFile(file)) {
                const name = file.substring(file.lastIndexOf(`/`) + 1);
                console.log(chalk.black.bgBlue('SQL File: ', name + ' has been modified'));
                promises.push(writeFile(name, file));
            }
        });
        res.deleted.forEach((file) => {
            file = renamePath(file);
            if (isProcedureFile(file)) {
                deleteFile(file);
            }
        });
        res.created.forEach((file) => {
            file = renamePath(file);
            if (isProcedureFile(file)) {
                createFile(file);
            }
        });
        res.renamed.forEach((file) => {
            file = renamePath(file);
            if (isProcedureFile(file)) {
                deleteFile(file.from);
                createFile(file.to);
            }
        });
        await Promise.all(promises);
        const noChanges = _.isEqual(_.sortBy(originalIndexJSON), _.sortBy(indexJSON));
        if(noChanges){
            console.log(chalk.white.bgBlue.bold(`No changes made to ./proceduresMethods/index.json`));
        }
        else{   
            await Promise.all([
                new Promise((resolve, reject) => {
                    fs.writeFile(`./proceduresMethods/index.json`, JSON.stringify(indexJSON), (err) => {
                        if (err) reject(err);
                        console.log(chalk.white.bgGreen.bold(`./proceduresMethods/index.json Saved!`));
                        simpleGit.add(`./proceduresMethods/index.json`);
                        resolve();
                    });
                })
            ]);
        }

    } catch (error) {
        console.log(chalk.black.bgRed(error));
        process.exit(1);
    }
}

const createFile = (file) => {
    const name = file.substring(file.lastIndexOf(`/`) + 1);
    const jsFileName = name.substring(0, name.indexOf('.sql')) + '.js';
    console.log(chalk.black.bgCyan('New SQL File: ', name));
    //Remove from JSON to avoid duplicates
    indexJSON = indexJSON.filter((item) => {
        return item !== jsFileName;
    });
    indexJSON.push(jsFileName);
    promises.push(writeFile(name, file));
}

const deleteFile = (file) => {
    const name = file.substring(file.lastIndexOf(`/`) + 1);
    console.log(chalk.black.bgRed('SQL File: ', name + ' has been deleted'));
    const jsFileName = name.substring(0, name.indexOf('.sql')) + '.js';
    //Remove from JSON
    indexJSON = indexJSON.filter((item) => {
        return item !== jsFileName;
    });
    //Remove JS
    promises.push(
        new Promise((resolve, reject) => {
            //Check if file exists
            fs.access('./proceduresMethods/' + jsFileName, fs.F_OK, (err) => {
                if (err) {
                    console.log(chalk.black.bgRed(jsFileName + ' doesnt exists, ignoring ...'));
                    resolve();
                }
                else {
                    fs.unlink('./proceduresMethods/' + jsFileName, (err) => {
                        if (err) reject(err);
                        console.log(chalk.black.bgRed(jsFileName + ' was deleted'));
                        resolve();
                    });
                }
            });
        })
    );
}

const writeFile = (name, path) => {
    return new Promise((resolve, reject) => {  
        console.log('NAME: ', name);
        console.log('PATH:', path);
        fileNameIsEqualToProcedureName(name, path).then((isEqual) => {
            if(!isEqual){
                reject('SQL FileName cannot be different from procedure name declared inside file, file with error: ' + name);
            }
            jsStrFile = generateJs(path).then(({ name, str }) => {
                fs.writeFile(`./proceduresMethods/${name}.js`, str, (err) => {
                    if (err) reject(err);
                    console.log(chalk.black.bgGreen(`./proceduresMethods/${name}.js Saved!`));
                    simpleGit.add(`./proceduresMethods/${name}.js`);
                    resolve();
                });
            });
        });
    });
}

const fileNameIsEqualToProcedureName = (file, path) => {
    
    file = '../MySQL/Procedures/'+file;
    return new Promise((resolve, reject) => {    
        fs.access(path, fs.F_OK, (err) => {
            if (err) {
                console.log(chalk.black.bgRed(path + ' doesnt exists'));
                reject(err);
                return;
            }
            //get Procedure name
            fs.readFile(path, "utf-8", (err, data) => {
                if (err) {
                    reject(err);
                }
                data = data.substring(data.indexOf("CREATE PROCEDURE") + 16);
                data = data.trimLeft();
                const methodName = data.substring(0, data.indexOf("(")).trim();
                let fileName = file.substring(file.lastIndexOf('/')+1);
                fileName = fileName.replace('.sql', '');
                resolve(fileName === methodName);
            });
        });
    });
}

main();
exports.readGit = main;