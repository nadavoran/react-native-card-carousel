import React, { PureComponent } from "react";
import { View, StyleSheet, Animated, Easing, TouchableOpacity } from "react-native";

const DEFAULT_DOT_SIZE = 7;
const DEFAULT_DOT_COLOR = "rgba(255, 255, 255, 0.92)";

export default class PaginationDot extends PureComponent {
	constructor(props) {
		super(props);
		this.dotAnimation = new Animated.Value(0);
		this.dotSpringAnimation = new Animated.Value(0);
		this.state = {
			// backgroundColor: "rgba(255, 255, 255, 0.92)"
			backgroundColor: "rgba(0, 0, 0, 0.75)"
		};
	}

	componentDidMount() {
		if (this.props.active) {
			this._animate(1);
		}

		this.props.pickedColor.call(this, this.props.index);
	}

	componentWillUnmount() {
		if (this.props.active) {
			this._animate(1);
		}

		this.props.pickedColor.call(this, this.props.index, true);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.active !== this.props.active) {
			this._animate(nextProps.active ? 1 : 0);
		}
	}

	_animate(toValue = 0) {

		const commonProperties = {
			toValue,
			duration: 250,
			isInteraction: false,
			useNativeDriver: true
		};

		let animations = [
			Animated.timing(this.dotAnimation, {
				easing: Easing.linear,
				...commonProperties
			}),
			Animated.spring(this.dotSpringAnimation, {
				friction: 4,
				tension: 50,
				...commonProperties
			})
		];

		Animated.parallel(animations).start();
	}

	changeBackgroundColor = (backgroundColor)=>{
		this.setState({backgroundColor});
	};

    onPress = ()=>{
		this.props.dotAction && this.props.dotAction(this.props.index);
	};

	render() {
		const {
			active,
			activeOpacity,
			containerStyle,
			inactiveStyle,
			inactiveOpacity,
			inactiveScale,
			style,
			pickedColor,
			dotAction
		} = this.props;

		const animatedStyle = {
			opacity: this.dotAnimation.interpolate({
				inputRange: [0, 1],
				outputRange: [inactiveOpacity, 1]
			}),
			transform: [
				{
					scale: this.dotSpringAnimation.interpolate({
						inputRange: [0, 1],
						outputRange: [inactiveScale, 1]
					})
				}
			]
		};

		const dotContainerStyle = [styles.sliderPaginationDotContainer, containerStyle || {}];

		const dotStyle = [
			styles.sliderPaginationDot,
			style || {},
			(!active && inactiveStyle) || {},
			pickedColor ? { backgroundColor: this.state.backgroundColor } : {},
			animatedStyle
		];

		return (
			<TouchableOpacity
				style={[dotContainerStyle]}
				activeOpacity={dotAction ? activeOpacity : 1}
				onPress={this.onPress}
				// hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
			>
				<Animated.View style={dotStyle} />
			</TouchableOpacity>
		);
	}
}


const styles = StyleSheet.create({
    sliderPaginationDotContainer: {
        alignItems: "center",
        justifyContent: "center"
    },
    sliderPaginationDot: {
        width: DEFAULT_DOT_SIZE,
        height: DEFAULT_DOT_SIZE,
        borderRadius: DEFAULT_DOT_SIZE / 2,
        backgroundColor: DEFAULT_DOT_COLOR
    }
});