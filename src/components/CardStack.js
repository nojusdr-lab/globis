import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import PetCard from './PetCard';
import { shouldClaim } from '../state/discovery.cjs';
export default function CardStack({pets,lang,onSwipeRight,onSwipeLeft,onOpenDetails,onResetStack,stackRef,reduceMotion=false}) {
 const position=useRef(new Animated.ValueXY()).current;
 const busy=useRef(false);
 const latest=useRef({});
 const {width}=useWindowDimensions();
 const trigger=direction=>{
   if(busy.current || !pets[0]) return;
   busy.current=true;
   const pet=pets[0];
   const finish=()=>{position.setValue({x:0,y:0});busy.current=false;(direction==='right'?onSwipeRight:onSwipeLeft)(pet);};
   if(reduceMotion) return finish();
   Animated.timing(position,{toValue:{x:direction==='right'?width:-width,y:0},duration:180,useNativeDriver:true}).start(({finished})=>{if(finished) finish();else busy.current=false;});
 };
 latest.current={trigger};
 useEffect(()=>{if(stackRef) stackRef.current={swipeRight:()=>latest.current.trigger('right'),swipeLeft:()=>latest.current.trigger('left'),getCurrentPet:()=>pets[0]};},[pets,stackRef]);
 const responder=useMemo(()=>PanResponder.create({
   onStartShouldSetPanResponder:()=>false,
   onMoveShouldSetPanResponder:(_,g)=>!busy.current && shouldClaim(g),
   onPanResponderMove:(_,g)=>position.setValue({x:g.dx,y:0}),
   onPanResponderRelease:(_,g)=>{
     if(Math.abs(g.dx)>80) latest.current.trigger(g.dx>0?'right':'left');
     else position.setValue({x:0,y:0});
   },
   onPanResponderTerminate:()=>position.setValue({x:0,y:0}),
 }),[position]);
 if(!pets[0]) return <View style={s.empty}><Text>Nepavyko rasti augintinių</Text><Text onPress={onResetStack} accessibilityRole="button">Atstatyti filtrus ir praleistus</Text></View>;
 return <View style={s.wrap}><Animated.View {...responder.panHandlers} style={[s.card,{transform:[{translateX:reduceMotion?0:position.x}]}]}><PetCard key={pets[0].id} pet={pets[0]} lang={lang} onOpenDetails={()=>onOpenDetails(pets[0])}/></Animated.View></View>;
}
const s=StyleSheet.create({wrap:{flex:1,padding:16,alignItems:'center'},card:{width:'100%',maxWidth:420,flex:1},empty:{flex:1,alignItems:'center',justifyContent:'center',gap:24}});
