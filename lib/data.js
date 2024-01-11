// dependencies

const fs = require('fs');
const path = require('path');

const lib = {}

// base directory of the data folder
lib.basedir = path.join(__dirname, '/../.data/');


// create returns fileDescriptor but read returns data as fileDescriptor (reference) is not required in read operation.
// write data to file
lib.create = (dir, file, data, callback) => {
    // open file for writing
    // wx is file system flag
    fs.open(`${lib.basedir + dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // convert data to string
            const stringData = JSON.stringify(data);

            // write data to file and then close it.
            fs.writeFile(fileDescriptor, stringData, (err2) => {
                if (!err2) {
                    fs.close(fileDescriptor, (err3) => {
                        if (!err3) {
                            callback(false);
                        } else {
                            callback('Error closing the new file.');
                        }
                    });
                } else {
                    callback('Error writing to new file.');
                }
            });
        } else {
            callback('Could not create new file, it may already exists!');
        }
    })
}

// read data from file
lib.read = (dir, file, callback) => {
    fs.readFile(`${lib.basedir + dir}/${file}.json`, 'utf-8', (err, data) => {
        callback(err, data);
    })
}

// update existing file
lib.update = (dir, file, data, callback) => {
    fs.open(`${lib.basedir + dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // convert the data to string
            const stringData = JSON.stringify(data);

            // truncate (clear) the file
            fs.ftruncate(fileDescriptor, (err2) => {
                if (!err2) {
                    // write to the file and close it.
                    fs.writeFile(fileDescriptor, stringData, (err3) => {
                        if (!err3) {
                            // close the file
                            fs.close(fileDescriptor, (err4) => {
                                if (!err4) {
                                    callback(false);
                                } else {
                                    callback('Error closing the file')
                                }
                            })
                        } else {
                            callback('Error writing to file.');
                        }
                    })
                } else {
                    callback('Error truncating file.');
                }
            })
        } else {
            callback('Err updating. File may not exist.')
        }
    })
}

// delete existing file
lib.delete = (dir, file, callback) => {
    // unlink file
    fs.unlink(`${lib.basedir + dir}/${file}.json`, (err) => {
        if (!err) {
            callback(false);
        } else {
            callback('Error deleting file.');
        }
    })
}


module.exports = lib;