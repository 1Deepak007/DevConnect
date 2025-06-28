import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    username:{type:String, required:true, unique:true},
    email:{type:String, required:true, unique:true},
    password:{type:String, required:true},  
    avatar:{type:String, default:"https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"},
    followers:[{type:mongoose.Schema.Types.ObjectId, ref:"User"}],
    following:[{type:mongoose.Schema.Types.ObjectId, ref:"User"}],
}, {timestamps:true});

export default mongoose.model("User", UserSchema);