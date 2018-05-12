import React, { PureComponent } from "react";
import { Dimensions, StyleSheet, View, Text, FlatList, Animated, Platform, Easing, PanResponder } from "react-native";
import _ from "lodash";

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);
const ANIMATION_DURATION = 300;

const { width: viewportWidth } = Dimensions.get("window");


export default class CardCarousel extends PureComponent {

    static defaultProps = {
        data: [],
        itemWidth: viewportWidth - 44,
        inactiveSlideOpacity: 0.5,
        inactiveSlideScale: 0.92,
        logger: console,
        scrollEnabled: true,
        exposeSwiping: ()=>{},
        onSnapToItem: ()=>{},
        renderItem: ()=>{},
        decelerationRate: 0.1,
        animationDuration: ANIMATION_DURATION
    };

    constructor(props) {
        super(props);

        this.state = {
            removingCard: false,
            cardBefore: -1,
            cardToRemove: -1,
            cardImmediateAfter: -1,
            cardFarAfter: -1
        };
        // Native driver for scroll events
        const scrollEventConfig = {
            listener: this._onScroll,
            useNativeDriver: true
        };
        this.finishSwipeAnimation = new Animated.Value(0);
        this._scrollPos = new Animated.Value(0);
        this._onScrollHandler = Animated.event(
            [ { nativeEvent: { contentOffset: { x: this._scrollPos } } } ],
            scrollEventConfig
        );
        this.scrollOffset = 0;
        this.scrollIndex = 0;
        this.itemCalcWidth = this.props.itemWidth;
        this.opacity = this.props.inactiveSlideOpacity;
        this.scale = this.props.inactiveSlideScale;
        this.logger = this.props.logger;

        this.firstPartAnimation = new Animated.Value(0);
        this.secondPartAnimation = new Animated.Value(0);

        this.outOfFocusAnimation = new Animated.Value(0);

        this.cleanScrollingDebounce = _.debounce(() => {
            this.logger.log(`cleanScrollingDebounce called`);
            this.scrolling = false;
            this.props.exposeSwiping && this.props.exposeSwiping(false);
        }, 100);

        this.viewabilityConfig = {
            waitForInteraction: true,
            itemVisiblePercentThreshold: 50
        };

        if ( Platform.OS === "android" && !this.props.pagingEnabled ) {
            this.panResponder = PanResponder.create({
                onStartShouldSetPanResponderCapture: this.handleGestureCaptureStart,
                onMoveShouldSetPanResponderCapture: this.handleGestureCapture,
                onPanResponderGrant: this.handleGestureGrant,
                onPanResponderMove: this.handleGestureMove,
                onPanResponderRelease: (event, state) => {
                    this.logger.log(`onPanResponderRelease: vx: ${state.vx}, dx:${state.dx}`);
                    return true;
                    // this.handleGestureRelease(event, state);
                },
                onPanResponderEnd: (event, state) => {
                    this.logger.log(`onPanResponderEnd: vx: ${state.vx}, dx:${state.dx}`);
                    // return true;
                    this.handleGestureRelease(event, state);
                },
                onPanResponderTerminated: (event, state) => {
                    this.logger.log(`onPanResponderTerminatede`);
                    this.handleGestureRelease(event, state);
                },
                onPanResponderTerminationRequest: this.handleGestureTerminationRequest
            });
        } else {
            this.panResponder= {panHandlers: {}};
        }
    }

    handleGestureCaptureStart = (event, gesture) => {
        const isCaptured = this.props.scrollEnabled && this.scrolling && !this.state.removingCard;
        this.logger.log(`handleGestureCaptureStart ${this.scrolling}, isCaptured: ${isCaptured}`);
        if (isCaptured){
            this.cancelFinishAnimation();
        }
        return isCaptured;
    };
    handleGestureCapture = (event, gesture) => {
        if ( !this.props.scrollEnabled || this.state.removingCard) return false;
        this.cleanScrollingDebounce();
        // this.duringScrollIndex = this.scrollIndex;
        this.scrolling = true;
        this.logger.log(`handleGestureCaptureMove ${Math.abs(gesture.dx) > 5}`);
        return Math.abs(gesture.dx) > 5;
    };
    handleGestureTerminationRequest = (event, state) => {
        this.logger.log(`handleGestureTerminationRequest`);
        return false;
    };

    getCurrentOffset = () => {
        return this.tempScrollPos || this.scrollIndex * this.itemCalcWidth;
    };

    handleGestureMove = (event, { dx }) => {
        const currentOffset = this.getCurrentOffset();
        const resolvedOffset = currentOffset - dx;

        this.scrolling = true;
        this.logger.log(`handleMove resolvedOffset:${resolvedOffset}`);
        if ( this.finishResponsder ) {
            clearTimeout(this.finishResponsder);
        }
        if ( this.flatList ) {
            this.flatList.scrollToOffset({
                offset: resolvedOffset,
                animated: false
            });
        }
    };
    cancelFinishAnimation=()=>{
        Animated.timing(this.finishSwipeAnimation).stop();
    };
    handleGestureGrant = (event, { dx, vx }) => {
        this.props.exposeSwiping(true);
        this.cancelFinishAnimation();
        if ( this.finishResponsder ) {
            clearTimeout(this.finishResponsder);
        }
    };
    handleGestureRelease = (event, { dx, vx }) => {
        this.logger.log(`release started currentScroll: ${this.scrollIndex}`);
        // current index * width ( 3* 100=> 300)
        const currentOffset = this.getCurrentOffset();
        // move right by 20 => 280
        const resolvedOffset = currentOffset - dx;

        const absoluteX = Math.abs(dx);
        const absoluteVelocity = Math.abs(vx);
        // For minimum progress (50) jump as many cards as the velocity indicates
        // to see the function graf: http://he.symbolab.com/solver/biquadratic-equation-calculator/f%5Cleft(x%5Cright)%3D0.5%5E%7B%5Cfrac%7B-x%7D%7B4%7D%7D%20%20
        const interpolatedVelocityCards = absoluteX > 50 ? Math.round(Math.pow(0.5, -absoluteVelocity / 4)) : 0;
        let newIndex =
            dx > 0
                ? Math.max(0, this.currentIndex - interpolatedVelocityCards)
                : Math.min(this.currentIndex + interpolatedVelocityCards, this.itemsLength - 1);
        this.logger.log(
            `release currentScroll: ${this.scrollIndex}, newIndex: ${newIndex}, dx: ${dx}, interVelCards: ${
                interpolatedVelocityCards
                }`
        );
        this.cleanScrollingDebounce(event);
        this.finishSwipeAnimation = new Animated.Value(resolvedOffset);
        let animatedListenerId = this.finishSwipeAnimation.addListener(event => {
            this.tempScrollPos = event.value;
            if ( this.flatList ) {
                this.flatList.scrollToOffset({
                    offset: event.value,
                    animated: false
                });
            }
        });
        let diff = Math.abs(newIndex - this.currentIndex);
        let toValue = this.itemCalcWidth * newIndex;
        this.cancelFinishAnimation();
        this.tempScrollPos = null;
        Animated.timing(this.finishSwipeAnimation, {
            useNativeDriver: true,
            duration: diff > 1 ? diff * 400 : (Math.abs(toValue - resolvedOffset) + 100 ) ,
            toValue: toValue,
            // easing: diff > 1 ? Easing.bezier(0.35, 0.57, 0.06, 0.97) : undefined
            easing: Easing.bezier(0, 0.01, 0.36, 0.99)
        }).start((event) => {
            this.finishSwipeAnimation.removeListener(animatedListenerId);
            this.logger.log(`Event: ${JSON.stringify(event)}`);
            if ( this.scrollIndex !== newIndex && event.finished) {
                this.scrollIndex = newIndex;
                this.logger.log(`release ended snapping to: ${this.scrollIndex}`);
                this.props.onSnapToItem(this.scrollIndex);
                this.props.exposeSwiping(false);
                this.tempScrollPos = null;
            } else if (!event.finish && this.tempScrollPos != null){
                this.scrollIndex = Math.round(this.tempScrollPos / this.itemCalcWidth);
            }
            this.finishResponsder = null;
            this.scrolling = false;
        });
    };

    calcInterpolators = length => {
        this.interpolators = [];
        let start = -this.itemCalcWidth / 2;
        let end = this.itemCalcWidth / 2;
        for (let i = 0; i < length; i++) {
            this.interpolators.push({ start, end });
            start += this.itemCalcWidth;
            end += this.itemCalcWidth;
        }
    };

    componentWillMount() {
        this.itemsLength = this.props.data.length;
        this.calcInterpolators(this.props.data.length);
    }

    componentWillUpdate(nextProps, nextState) {
        this.itemCalcWidth = nextProps.itemWidth;
        this.itemsLength = nextProps.data.length;
        const wasOutOfFocus = this.outOfFocus;
        this.outOfFocus = !!nextProps.extraDetails && !nextState.removingCard;
        if ( nextProps.data.length !== this.props.data.length ) {
            this.calcInterpolators(nextProps.data.length);
        }
        if ( wasOutOfFocus !== this.outOfFocus ) {
            if ( this.state.removingCard !== nextState.removingCard || (wasOutOfFocus && nextState.removingCard) ) {
                this.runRemoveAnimation({ removingCard: false }, true);
            } else {
                Animated.timing(this.outOfFocusAnimation, {
                    useNativeDriver: true,
                    duration: 250,
                    toValue: this.outOfFocus ? 1 : 0
                }).start(() => {
                });
            }
        } else if ( !this.outOfFocus && this.state.removingCard !== nextState.removingCard ) {
            this.runRemoveAnimation(this.state);
        }
    }

    runRemoveAnimation = prevState => {
        if ( !prevState.removingCard ) {
            if ( this.animating ) {
                return this.logger.log("componentDidUpdate already animating card removal");
            }

            this.logger.log("componentDidUpdate start animating card removal");
            this.animating = true;
            Animated.parallel([
                Animated.timing(this.outOfFocusAnimation, {
                    useNativeDriver: true,
                    duration: this.props.animationDuration,
                    toValue: this.outOfFocus ? 1 : 0
                }),
                Animated.sequence([
                    Animated.timing(this.firstPartAnimation, {
                        useNativeDriver: true,
                        duration: this.props.animationDuration,
                        // easing: Easing.bezier(0.785, 0.135, 0.15, 0.86), //easeInOutCirc
                        toValue: 1
                    }),
                    Animated.timing(this.secondPartAnimation, {
                        useNativeDriver: true,
                        // easing: Easing.bezier(0.785, 0.135, 0.15, 0.86), //easeInOutCirc
                        duration: this.props.animationDuration,
                        toValue: 1
                    })
                ])
            ]).start(() => {
                this.logger.log("componentDidUpdate done animating card removal");
                this.state.callback && this.state.callback();
                this.resetAnimatingCardRemoval();
                if ( Platform.OS === "android" ) {
                    requestAnimationFrame(() => this.scrollToIndex(this.scrollIndex, false));
                }
            });
        } else {
            this.logger.log("componentDidUpdate not removing card");
            this.resetAnimatingCardRemoval();
        }
    };

    resetAnimatingCardRemoval = () => {
        this.animating = false;
        this.firstPartAnimation.setValue(0);
        this.secondPartAnimation.setValue(0);
        this.setState({
            removingCard: false,
            cardBefore: -1,
            cardToRemove: -1,
            cardImmediateAfter: -1,
            cardFarAfter: -1
        });
    };

    _getScrollOffset(event) {
        return (
            (event &&
                event.nativeEvent &&
                event.nativeEvent.contentOffset &&
                Math.round(event.nativeEvent.contentOffset[ "x" ])) ||
            0
        );
    }

    onVisibleIndexesChanged = ({ viewableItems, changed }) => {
        if ( !viewableItems || !viewableItems.length ) return;
        this.logger.log(`onVisibleIndexesChanged changed from: ${this.onScrollIndex} to: ${viewableItems[ 0 ].index}`);

        const index = viewableItems[ 0 ].index;
        this.onIndexChanged(index);
        this.cleanScrollingDebounce();
    };

    onIndexChanged = index => {
        if ( index !== this.onScrollIndex && !this.snappingToIndex ) {
            if ( this.reportScroll ) {
                this.reportScroll = false;
            }
            this.scrollIndex = index;
            this.props.onSnapToItem(index);
        }
        this.onScrollIndex = index;
    };

    _onScroll = event => {
    };

    onTouchStart = event => {
        this.reportScroll = true;
    };
    onTouchEnd = event => {
        this.reportScroll = false;
    };

    onMomentumScrollBegin = event => {
        // console.log("[CardCarousel] Momentum Started");
        // const scrollOffset = this._getScrollOffset(event);
        // this.overTheEdge = scrollOffset < 0 || scrollOffset > this.itemCalcWidth * this.itemsLength;
    };
    onMomentumScrollEnd = event => {
        this.scrolling = false;
        this.logger.log(`Momentum Ended`);
        this.snappingToIndex = null;
        const index = this.getIndex(event);
        // requestAnimationFrame(() => Feedback.takeScreenShot("CardCarousel"));
        if ( index !== this.scrollIndex ) {
            this.logger.log(`Momentum Ended setting index: ${index}`);
            this.scrollToIndex(index, true);
            if ( index !== this.snappingToIndex ) {
                this.props.onSnapToItem(index);
            }
        }
        this.scrollIndex = index;
        this.scrolling = false;
        if ( this.cleanScrollingDebounce ) {
            this.cleanScrollingDebounce.cancel();
        }
    };
    renderItem = ({ item, index }) => {
        const { start, end } = this.interpolators[ index ];
        const middle = this.itemCalcWidth / 2 + start;
        const animatedOpacity = this._scrollPos.interpolate({
            // inputRange: [start, middle, end],
            inputRange: [ start, middle - 5, middle, middle + 5, end ],
            outputRange: [ this.opacity, 1, 1, 1, this.opacity ],
            extrapolate: "clamp"
        });
        const androidAnimatedOpacity = this._scrollPos.interpolate({
            // inputRange: [start, middle, end],
            inputRange: [ start, middle - 5, middle, middle + 5, end ],
            outputRange: [ this.opacity, 0, 0, 0, this.opacity ],
            extrapolate: "clamp"
        });
        const animatedScale = this._scrollPos.interpolate({
            inputRange: [ start, middle - 5, middle, middle + 5, end ],
            outputRange: [ this.scale, 1, 1, 1, this.scale ],
            extrapolate: "clamp"
        });
        const animatedTranslateX = this._scrollPos.interpolate({
            inputRange: [ 0, this.itemsLength * this.itemCalcWidth ],
            outputRange: [ 50, this.itemsLength * 65 ],
            extrapolate: "clamp"
        });

        const containerStyle = {
            opacity: Platform.select({ ios: animatedOpacity, android: 1 }),
            transform: [ { scale: animatedScale } ]
        };
        return (
            <Animated.View style={[ containerStyle, styles.cardContainer ]} pointerEvents={"box-none"}>
                {this.props.renderItem({ item, index })}
                {Platform.select({
                    android: (
                        <Animated.View
                            pointerEvents={"none"}
                            style={[
                                styles.androidShield,
                                {
                                    opacity: androidAnimatedOpacity
                                }
                            ]}
                        />
                    )
                })}
            </Animated.View>
        );
    };

    getIndex(event) {
        this.scrollOffset = this._getScrollOffset(event);
        const index = this.scrollOffset / this.itemCalcWidth;
        return Math.abs(Math.round(index));
    }

    get currentIndex() {
        return this.scrollIndex;
    }

    scrollToIndex(index, animated) {
        this.logger.log(`scrollToIndex to index: ${index}`);
        this.flatList && this.flatList.scrollToOffset({ offset: this.itemCalcWidth * index, animated });
        if ( !animated ) {
            this._scrollPos.setValue(this.scrollIndex * this.itemCalcWidth);
            this.snappingToIndex = null;
        }
    }

    snapToItem = (index = 0, animated = true) => {
        if ( this.flatList && !this.scrolling && this.itemsLength && this.scrollIndex !== index ) {
            this.logger.log(`snapToItem from: ${this.scrollIndex} to index: ${index}`);
            // index = Math.max(0, index);
            this.snappingToIndex = index;
            this.scrollIndex = index;
            this.scrollToIndex(index, animated);
        } else {
            this.logger.log(`snapToItem ignored for index: ${index}, items length: ${this.itemsLength}`);
        }
    };

    renderCardFromIndex = (index, animatedStyle, animatedOpacity, fixLastCardShield) => {
        if ( index < 0 || index >= this.itemsLength ) return null;
        const item = this.props.data[ index ];
        return (
            <Animated.View
                style={[
                    styles.cardContainer,
                    animatedStyle,
                    {
                        opacity: Platform.select({ ios: animatedOpacity }),
                        position: "absolute",
                        top: 0,
                        right: 0,
                        left: 0,
                        bottom: 0
                    }
                ]}
                pointerEvents={"box-none"}
            >
                {this.props.renderItem({ item, index })}
                {Platform.select({
                    android: (
                        <Animated.View
                            pointerEvents={"none"}
                            style={[
                                styles.androidShield,
                                fixLastCardShield,
                                {
                                    opacity: animatedOpacity
                                }
                            ]}
                        />
                    )
                })}
            </Animated.View>
        );
    };

    removeIndex = (index, callback, animated = true) => {
        if ( !animated ) {
            this.logger.log(`removing card without animation for index: ${index}, just calling the callback`);
            callback && callback();
            return;
        }
        if ( index >= 0 && index < this.itemsLength ) {
            this.scrollIndex = index;
            const atTheEnd = index === this.itemsLength - 1;
            const cardBefore = atTheEnd ? -1 : index - 1;
            const cardImmediateAfter = atTheEnd ? index - 1 : index + 1;
            const cardFarAfter = atTheEnd ? index - 2 : index + 2;
            this.logger.log(
                `removing card from index: ${index}, cardBefore: ${cardBefore}, cardImmediateAfter: ${
                    cardImmediateAfter
                    }, cardFarAfter: ${cardFarAfter}`
            );
            this.setState({
                removingCard: true,
                cardBefore,
                cardToRemove: index,
                cardImmediateAfter,
                cardFarAfter,
                callback
            });
        } else {
            this.logger.log(`removing card ignored for index: ${index}, items length: ${this.itemsLength}`);
        }
    };

    renderRemovingCards() {
        if ( this.state.cardToRemove < 0 || this.state.cardToRemove >= this.itemsLength ) {
            return null;
        }
        this.logger.log("renderRemovingCards - rendering the cards for animating removal");
        let fixAndroidWidth = Platform.select({ ios: 0, android: 2 });
        const scaleY = this.firstPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ this.scale, 1 ]
        });
        const opacity = this.firstPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ this.opacity, Platform.select({ ios: 1, android: 0 }) ]
        });
        // In order to get the right start position we need to add the card width adding the space between the cards
        // That is why we take in count the scale and davide by 4 (the 2 sides of the card and one side from each of the cards next to it)
        const relativeWidth = this.itemCalcWidth * (1 + (1 - this.scale) / 4);
        const startPos =
            this.state.cardToRemove !== this.itemsLength - 1
                ? relativeWidth + 44 + fixAndroidWidth
                : -relativeWidth - fixAndroidWidth;
        // : -relativeWidth - fixAndroidWidth;
        const translateX = this.secondPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ startPos, 22 ]
        });
        // const fixLastCardShield = this.state.cardToRemove === this.itemsLength - 1 ? { right: 44 } : null;
        const fixLastCardShield = { right: 44 };
        const scaleX = this.secondPartAnimation.interpolate({
            inputRange: [ 0, 0.1, 1 ],
            outputRange: [ this.scale, 1, 1 ]
        });
        const afterAnimation = {
            transform: [ { scaleY }, { scaleX }, { translateX } ]
        };

        const translateFarX = this.secondPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ startPos * 2, startPos ]
        });
        const farAfter = {
            transform: [ { scale: this.scale }, { translateX: translateFarX } ]
        };

        const scale = this.firstPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ 1, this.scale ]
        });
        const removeOpacity = this.firstPartAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ Platform.select({ ios: 1, android: 0 }), this.opacity ]
        });
        const removeAnimation = {
            transform: [ { scale }, { translateX: 22 } ]
        };

        return (
            <Animated.View style={[ styles.cardToMove, this.getOutOfFocus() ]}>
                {this.renderCardFromIndex(
                    this.state.cardBefore,
                    {
                        transform: [ { scale: this.scale }, { translateX: -this.itemCalcWidth - 7 - fixAndroidWidth } ]
                    },
                    this.opacity,
                    fixLastCardShield
                )}
                {this.renderCardFromIndex(this.state.cardToRemove, removeAnimation, removeOpacity, fixLastCardShield)}
                {this.renderCardFromIndex(this.state.cardImmediateAfter, afterAnimation, opacity, fixLastCardShield)}
                {this.renderCardFromIndex(this.state.cardFarAfter, farAfter, this.opacity, fixLastCardShield)}
            </Animated.View>
        );
    }

    getOutOfFocus = () => {
        const scale = this.outOfFocusAnimation.interpolate({
            inputRange: [ 0, 1 ],
            outputRange: [ 1, 0.8 ]
        });
        return {
            overflow: this.outOfFocus || this.state.removingCard ? "visible" : "hidden",
            transform: [ { scale } ]
        };
    };

    render() {
        let hiddenStyle = {};
        if ( this.state.removingCard ) {
            this.renderRemovingCards();
            hiddenStyle = Platform.select({
                ios: { display: "none", position: "absolute" },
                android: { opacity: 0.01 }
            });
        }
        const {
            data,
            renderItem,
            keyExtractor,
            sliderWidth,
            // itemWidth,
            contentContainerCustomStyle,
            containerCustomStyle,
            scrollEnabled,
            decelerationRate,
            pagingEnabled,
            extraDetails,
            initialNumToRender
        } = this.props;
        return (
            <Animated.View style={[ { flex: 1 } ]} {...this.panResponder.panHandlers}>
                <AnimatedFlatList
                    ref={c => {
                        if ( c ) {
                            this.flatList = c.getNode();
                        }
                    }}
                    data={data}
                    initialNumToRender={initialNumToRender}
                    style={[ styles.container, containerCustomStyle, hiddenStyle, this.getOutOfFocus() ]}
                    renderItem={this.renderItem}
                    keyExtractor={keyExtractor}
                    keyboardShouldPersistTaps={"handled"}
                    contentContainerStyle={[ styles.contentContainer, contentContainerCustomStyle ]}
                    horizontal
                    decelerationRate={decelerationRate}
                    snapToInterval={this.itemCalcWidth}
                    pagingEnabled={pagingEnabled || Platform.OS === "android"}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={10}
                    overScrollMode={Platform.select({ ios: "never", android: "auto" })}
                    scrollEnabled={!(Platform.OS === "android" && !this.props.pagingEnabled) && scrollEnabled}
                    onMomentumScrollEnd={this.onMomentumScrollEnd}
                    onScroll={this._onScrollHandler}
                    onTouchStart={this.onTouchStart}
                    onTouchEnd={this.onTouchEnd}
                    extraDetails={extraDetails}
                    onViewableItemsChanged={this.onVisibleIndexesChanged}
                    viewabilityConfig={this.viewabilityConfig}
                />
                {this.renderRemovingCards()}
            </Animated.View>
        );
    }
}

const styles = StyleSheet.create({
    contentContainer: {
        paddingRight: 22,
        paddingLeft: 22
    },
    cardToMove: {
        paddingRight: 22,
        paddingLeft: 22,
        top: 10,
        bottom: 63,
        position: "absolute",
        right: 0,
        left: 0
    },
    cardContainer: {
        height: "100%",
        borderRadius: 4,
        backgroundColor: "transparent",
        overflow: "hidden"
    },
    androidShield: {
        position: "absolute",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "transparent",
        elevation: 10,
        top: -20,
        bottom: 0,
        right: 0,
        left: 0
    }
});
