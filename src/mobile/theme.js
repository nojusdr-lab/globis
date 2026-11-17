import {Platform,StyleSheet} from 'react-native';

// Design tokens ported from the approved GLOBIS interactive prototype.
// Brand green stays #245B46; neutrals are a cool green-grey ramp.
export const C={
 green:'#245B46',greenInk:'#1A4535',tint:'#E7F0EB',tint2:'#D3E4DA',
 bg:'#F6F9F8',white:'#FFFFFF',surface2:'#EDF2F0',line:'#E0E8E4',line2:'#C9D6CF',
 ink:'#0F1F19',ink2:'#364640',muted:'#5C6D65',
 okBg:'#E3F1EA',okInk:'#1C4A38',warnBg:'#FBEFD4',warnInk:'#744A08',mutBg:'#ECF0EE',mutInk:'#46564F',
 amber:'#744A08',danger:'#B4412F',
 // legacy aliases kept for older call sites
 soft:'#E7F0EB',
};
export const serif=Platform.select({ios:'Georgia',android:'serif',web:'Newsreader, Georgia, "Times New Roman", serif',default:undefined});
const shadow=Platform.select({web:{boxShadow:'0 1px 2px rgba(15,31,25,.05), 0 12px 28px -14px rgba(15,31,25,.26)'},default:{shadowColor:'#0F1F19',shadowOpacity:0.12,shadowRadius:14,shadowOffset:{width:0,height:8},elevation:3}});

export const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:C.bg},shell:{flex:1,width:'100%',maxWidth:1100,alignSelf:'center'},
 header:{paddingHorizontal:16,paddingVertical:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,minHeight:56},
 logo:{width:132,height:36},row:{flexDirection:'row',alignItems:'center',gap:8},

 heading:{fontSize:30,lineHeight:36,fontWeight:'500',color:C.ink,fontFamily:serif},
 title:{fontSize:18,lineHeight:24,fontWeight:'600',color:C.ink},
 body:{fontSize:16,lineHeight:24,color:C.ink2},
 muted:{fontSize:14,lineHeight:20,color:C.muted},
 label:{fontSize:13,lineHeight:18,fontWeight:'600',color:C.muted},

 button:{minHeight:48,minWidth:48,borderRadius:24,paddingHorizontal:16,paddingVertical:10,backgroundColor:C.white,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,borderWidth:1,borderColor:C.line2},
 primary:{backgroundColor:C.green,borderColor:C.green},soft:{backgroundColor:C.tint,borderColor:C.tint},
 buttonText:{fontSize:15,lineHeight:20,fontWeight:'600',color:C.green},primaryText:{color:C.white},disabled:{opacity:0.45},
 selected:{backgroundColor:C.green,borderColor:C.green},
 iconButton:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},

 toolbar:{paddingHorizontal:16,paddingBottom:8,flexDirection:'row',alignItems:'center',gap:8},
 search:{flex:1,minHeight:48,borderRadius:24,borderWidth:1,borderColor:C.line,backgroundColor:C.white,flexDirection:'row',alignItems:'center',paddingLeft:14,paddingRight:4,gap:8},
 searchInput:{flex:1,minHeight:46,fontSize:16,color:C.ink,paddingVertical:0},
 filterBtn:{width:48,height:48,borderRadius:24,borderWidth:1,borderColor:C.line,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},
 filterBtnOn:{backgroundColor:C.green,borderColor:C.green},
 countBadge:{position:'absolute',top:-3,right:-3,minWidth:20,height:20,borderRadius:10,backgroundColor:C.ink,alignItems:'center',justifyContent:'center',paddingHorizontal:5,borderWidth:2,borderColor:C.bg},
 countBadgeText:{color:C.white,fontSize:11,fontWeight:'700'},
 chip:{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:C.line,backgroundColor:C.white,flexDirection:'row',alignItems:'center',gap:6},
 chipOn:{backgroundColor:C.green,borderColor:C.green},
 chipText:{fontSize:14,fontWeight:'500',color:C.ink2},chipTextOn:{color:C.white},chipCount:{fontSize:12,color:C.muted},chipCountOn:{color:'rgba(255,255,255,0.75)'},

 card:{backgroundColor:C.white,borderRadius:26,overflow:'hidden',borderWidth:1,borderColor:C.line,...shadow},
 cardInfo:{paddingHorizontal:16,paddingTop:14,paddingBottom:16,gap:6,borderTopWidth:1,borderTopColor:C.line,backgroundColor:C.white},
 cardName:{fontSize:27,lineHeight:32,fontWeight:'500',color:C.ink,fontFamily:serif,flexShrink:1},
 more:{fontSize:14,fontWeight:'600',color:C.green},
 onPhoto:{position:'absolute',zIndex:3,flexDirection:'row',gap:6},
 countChip:{height:26,paddingHorizontal:10,borderRadius:13,backgroundColor:'rgba(255,255,255,0.94)',justifyContent:'center'},
 countChipText:{fontSize:12.5,fontWeight:'600',color:C.ink,fontVariant:['tabular-nums']},
 stamp:{position:'absolute',top:46,zIndex:4,paddingHorizontal:12,paddingVertical:6,borderRadius:10,borderWidth:2.5,backgroundColor:C.white},
 stampText:{fontWeight:'700',fontSize:15,letterSpacing:0.9},
 actions:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
 act:{height:56,borderRadius:28,alignItems:'center',justifyContent:'center',backgroundColor:C.white,borderWidth:1,borderColor:C.line2},
 actRound:{width:56},actSmall:{width:48,height:48,borderRadius:24},
 actSave:{flex:1,flexDirection:'row',gap:8,backgroundColor:C.green,borderColor:C.green},
 actSaveText:{color:C.white,fontSize:16,fontWeight:'600'},
 hint:{fontSize:12,lineHeight:16,color:C.muted,textAlign:'center'},

 gcard:{flex:1,margin:6,gap:6},
 gphoto:{borderRadius:20,overflow:'hidden',borderWidth:1,borderColor:C.line,backgroundColor:C.tint},
 gname:{fontSize:19,lineHeight:24,fontWeight:'500',color:C.ink,fontFamily:serif},
 heart:{position:'absolute',top:8,right:8,zIndex:3,width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,0.94)',alignItems:'center',justifyContent:'center'},
 photo:{width:'100%',backgroundColor:C.tint},placeholder:{alignItems:'center',justifyContent:'center',gap:8},

 status:{flexDirection:'row',alignItems:'center',gap:5,height:26,paddingLeft:8,paddingRight:10,borderRadius:13,alignSelf:'flex-start'},
 statusText:{fontSize:12.5,fontWeight:'600'},
 note:{flexDirection:'row',gap:10,padding:14,borderRadius:16},
 facts:{flexDirection:'row',flexWrap:'wrap',gap:10},
 fact:{flexGrow:1,flexBasis:'45%',minHeight:64,borderRadius:16,paddingHorizontal:14,paddingVertical:10,backgroundColor:C.surface2,gap:2},
 factUnknown:{backgroundColor:'transparent',borderWidth:1.5,borderStyle:'dashed',borderColor:C.line2},
 factLabel:{fontSize:12,color:C.muted,fontWeight:'500'},factValue:{fontSize:16,fontWeight:'600',color:C.ink},factValueUnknown:{fontSize:15,fontWeight:'500',color:C.muted},
 section:{gap:10},sectionTitle:{fontSize:13.5,fontWeight:'600',color:C.muted},
 todo:{borderWidth:1,borderColor:C.line,borderRadius:18,paddingHorizontal:14,paddingVertical:4},
 todoRow:{flexDirection:'row',gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.line},
 org:{flexDirection:'row',alignItems:'center',gap:12,padding:12,borderWidth:1,borderColor:C.line,borderRadius:18,backgroundColor:C.white,minHeight:64},
 avatar:{width:46,height:46,borderRadius:23,backgroundColor:C.tint,alignItems:'center',justifyContent:'center'},
 avatarText:{color:C.green,fontWeight:'700',fontSize:15},

 tabsWrap:{paddingHorizontal:14,paddingTop:6,paddingBottom:8},
 tabs:{flexDirection:'row',backgroundColor:C.white,borderWidth:1,borderColor:C.line,borderRadius:30,padding:6,...shadow},
 tab:{flex:1,minHeight:54,borderRadius:24,alignItems:'center',justifyContent:'center',gap:2},
 tabActive:{backgroundColor:C.tint},tabText:{fontSize:12,fontWeight:'600',color:C.muted},tabTextActive:{color:C.green},
 tabBadge:{position:'absolute',top:4,left:'54%',minWidth:18,height:18,borderRadius:9,backgroundColor:C.green,alignItems:'center',justifyContent:'center',paddingHorizontal:4},
 tabBadgeText:{color:C.white,fontSize:11,fontWeight:'700'},

 content:{padding:16,gap:16},empty:{padding:32,alignItems:'center',justifyContent:'center',gap:12,flex:1},
 emptyArt:{width:88,height:88,borderRadius:44,backgroundColor:C.tint,alignItems:'center',justifyContent:'center',marginBottom:4},
 emptyTitle:{fontSize:23,lineHeight:29,fontWeight:'500',color:C.ink,fontFamily:serif,textAlign:'center'},

 backdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(12,24,18,0.42)'},modal:{flex:1,justifyContent:'flex-end'},
 sheet:{maxHeight:'94%',width:'100%',maxWidth:640,alignSelf:'center',backgroundColor:C.white,borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden'},
 grab:{alignSelf:'center',width:38,height:4.5,borderRadius:3,backgroundColor:C.line2,marginTop:10},
 sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:20,paddingRight:12,paddingTop:6,paddingBottom:8,gap:12},
 sheetTitle:{flex:1,fontSize:25,lineHeight:30,fontWeight:'500',color:C.ink,fontFamily:serif},
 sheetFooter:{paddingHorizontal:16,paddingTop:12,gap:8,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.line},

 input:{minHeight:48,padding:12,borderWidth:1,borderColor:C.line,borderRadius:16,backgroundColor:C.white,fontSize:16,color:C.ink},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:8},
 toast:{position:'absolute',left:16,right:16,bottom:96,zIndex:20,flexDirection:'row',alignItems:'center',gap:12,paddingLeft:16,paddingRight:8,minHeight:48,backgroundColor:C.ink,borderRadius:16},
 toastText:{flex:1,color:C.white,fontSize:14,lineHeight:20,paddingVertical:10},
 toastAction:{minHeight:44,paddingHorizontal:10,justifyContent:'center'},toastActionText:{color:'#B5E48C',fontWeight:'700',fontSize:14},
 listCard:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:20,backgroundColor:C.white,borderWidth:1,borderColor:C.line},
 tag:{alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:4,borderRadius:13,backgroundColor:C.surface2},tagText:{fontSize:12.5,color:C.ink2,fontWeight:'500'},
 separator:{height:1,backgroundColor:C.line,marginVertical:8},link:{fontSize:16,lineHeight:24,color:C.green,textDecorationLine:'underline'},
 banner:{marginHorizontal:16,marginBottom:8,padding:12,borderRadius:14,backgroundColor:C.warnBg,gap:8},
});
