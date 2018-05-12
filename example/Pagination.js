import React, { PureComponent } from "react";
import { StyleSheet, View, FlatList } from "react-native";
import PaginationDot from "./PaginationDot";

export default class Pagination extends PureComponent {

    static defaultProps = {
        inactiveDotOpacity: 0.5,
        inactiveDotScale: 0.5,
        tappableDots: false,
        vertical: false,
        logger: console
    };

    constructor(props) {
        super(props);

        this.scrollPos = 0;
        this.activeDotIndex = this.props.activeDotIndex;

        this.logger = this.props.logger;
    }

    componentWillUpdate(nextProps) {
        if (this.props.activeDotIndex !== nextProps.activeDotIndex){
            this.activeDotIndex = nextProps.activeDotIndex;
        }
        if (!this.scrollView || !this.scrollView.scrollTo) return;
        if (
            nextProps.activeDotIndex * nextProps.dotTotalWidth >
            this.scrollPos + nextProps.maxWidth - nextProps.dotTotalWidth
        ) {
            // need to scroll the to the active dot + the pagination jump
            this.scrollPos =
                nextProps.activeDotIndex * nextProps.dotTotalWidth - nextProps.maxWidth + nextProps.nextPaginationJump;
            this.scrollPos = Math.min(
                nextProps.dotsLength * nextProps.dotTotalWidth - nextProps.maxWidth - nextProps.nextPaginationJump,
                this.scrollPos
            );
            this.scrollView.scrollTo({ x: this.scrollPos, animated: true });
        } else if (nextProps.activeDotIndex * nextProps.dotTotalWidth < this.scrollPos + nextProps.dotTotalWidth) {
            this.scrollPos = nextProps.activeDotIndex * nextProps.dotTotalWidth - nextProps.nextPaginationJump;
            this.scrollPos = Math.max(0, this.scrollPos);
            this.scrollView.scrollTo({ x: this.scrollPos, animated: true });
        }
    }
    handleScroll = event => {
        this.scrollPos = event.nativeEvent.contentOffset.x;
    };


    keyExtractor = (item, index) => {
        return `pagination-dot-${item.id}`;
    };

    defaultTappableAction= (index)=>{
        this.activeDotIndex = index;
        this.props.carouselRef && this.props.carouselRef.snapToItem(index);
    };

    renderItem=({item, index})=>{
        const {
            activeOpacity,
            carouselRef,
            dotColor,
            dotContainerStyle,
            dotStyle,
            inactiveDotColor,
            inactiveDotOpacity,
            inactiveDotScale,
            inactiveDotStyle,
            pickedColor,
            tappableDots,
            dotAction
        } = this.props;
        return <PaginationDot
            carouselRef={carouselRef}
            // tappable={(tappableDots && typeof carouselRef !== "undefined") || dotAction}
            dotAction={(tappableDots && typeof carouselRef !== "undefined") ? this.defaultTappableAction : dotAction}
            activeOpacity={activeOpacity}
            index={index}
            color={dotColor}
            containerStyle={dotContainerStyle}
            style={dotStyle}
            active={this.activeDotIndex === index}
            pickedColor={pickedColor}
            inactiveColor={inactiveDotColor}
            inactiveOpacity={inactiveDotOpacity}
            inactiveScale={inactiveDotScale}
            inactiveStyle={inactiveDotStyle}
        />;
    };

    render() {
        const { dotsLength, dotsData, dotAction, containerStyle, vertical, tappableDots } = this.props;

        if (!dotsLength || dotsLength < 2) {
            return false;
        }
        let dots = dotsData;
        if (!dots){
            dots = [];
            for (let i = 0; i < dotsLength; i++){
                dots.push({ id: i });
            }
        }

        const style = [
            styles.sliderPagination,
            {
                opacity: tappableDots || dotAction ? 1 : 0.5
            },
            containerStyle || {}
        ];

        return (
            <FlatList
                ref={c => (this.scrollView = c)}
                onScroll={this.handleScroll}
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                pointerEvents={"box-none"}
                horizontal
                scrollEnabled={true}
                style={style.scrollView}
                contentContainerStyle={style}
                renderItem={this.renderItem}
                keyExtractor={this.keyExtractor}
                data={dots}
            />
        );
    }
}

const styles = StyleSheet.create({
    scrollView: {},
    sliderPagination: {
        flexDirection: "row"
    }
});
