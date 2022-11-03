const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const validator = require('validator') // https://www.npmjs.com/package/validator
const ObjectId = mongoose.Schema.Types.ObjectId
/* ------------------------------------------------------- */

modelName = 'Deposit'

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter a name'],
      minLength: [4, 'That seems too short to be a name']
    },
    email: {
      type: String,
      required: [true, 'Please enter an email address'],
      lowercase: true,
      validate: [validator.isEmail, 'Please enter a valid email address']
    },
    litterId: {
      type: ObjectId,
      required: [true, 'The id of the litter this deposit is against']
    },
    confirmed: {
      type: Boolean
    },
    resolved: {
      type: Boolean
    },
    note: {
      type: String
    }
  },
  { timestamps: true }
)

/* ------------------------------------------------------- */
schema.statics = {
  async listAll() {
    return await this.find({})
  }
}
/* ------------------------------------------------------- */
schema.set('toObject', { virtuals: true })
schema.plugin(mongoosePaginate)
module.exports = mongoose.model(modelName, schema)
