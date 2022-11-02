const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')
const validator = require('validator') // https://www.npmjs.com/package/validator
const ObjectId = mongoose.Schema.Types.ObjectId
/* ------------------------------------------------------- */

modelName = 'Litter'

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      minlength: [4, 'Title must be at least 4 characters']
    },
    imageUrl: {
      type: String,
      required: [true, 'Image is required']
    },
    expectedCount: {
      type: Number,
      required: [true, 'An expected number of puppies is required']
    },
    sellingDeposits: {
      type: Boolean
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
