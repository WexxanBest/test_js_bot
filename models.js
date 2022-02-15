const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/db');

const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;


const ItemSchema = new Schema({
    id: Number,
    name: String,
    status: String,
    owner: {type: Schema.Types.ObjectId, ref: 'User'},
    publisher: {type: Schema.Types.ObjectId, ref: 'User'}
})

const UserSchema = new Schema({
    id: Number,
    is_bot: Boolean,
    first_name: String,
    username: String,
    lang: String,
    items:[
      {type: Schema.Types.ObjectId, ref: 'Item'}
    ]
})

const Item = mongoose.model('Item', ItemSchema)
const User = mongoose.model('User', UserSchema)

module.exports = { mongoose, User, Item }