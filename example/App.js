import React from 'react';
import { Dimensions, StyleSheet, Text, View, Button } from 'react-native';
import { CardCarousel } from "./CardCarousel";
import Pagination from "./Pagination";

const { width: viewportWidth, height: viewportHeight } = Dimensions.get("window");


const data = [
    {
        id: 1,
        type: "A",
        title: "First",
        content: "Card 1",
    },
    {
        id: 2,
        type: "B",
        title: "Second",
        content: "Card 2"
    },
    {
        id: 3,
        type: "B",
        title: "Third",
        content: "Card 3"
    },
    {
        id: 4,
        type: "C",
        title: "Fourth",
        content: "Card 4"
    },
    {
        id: 5,
        type: "C",
        title: "Fifth",
        content: "Card 5"
    },
    {
        id: 6,
        type: "C",
        title: "Sixth",
        content: "Card 6"
    },
    {
        id: 7,
        type: "D",
        title: "Seventh",
        content: "Card 7"
    },
];
const colors = ["#e57373", "#a793cc", "#a793cc", "#60a9e5", "#60a9e5", "#60a9e5", "#9e8668"];

export default class App extends React.Component {
    constructor(){
        super();
        this.state = {
            activeIndex:0
        };
    }

    renderItem = ({ item, index }) => {
        return <View
            style={{
                height: "100%",
                backgroundColor: "white",
                width: viewportWidth - 44,
                borderRadius: 4,
                paddingTop: 5,
                elevation: 3,
                justifyContent: "center",
                borderWidth: 1,
                alignItems: "center",
                overflow: "hidden"
            }}
        >
            <View>
                <Text>ID: {item.id}</Text>
                <Text>Type: {item.type}</Text>
                <Text>Index: {index}</Text>
                <Text>Title: {item.title}</Text>
                <Text>Content: {item.content}</Text>
            </View>
            <View style={{marginTop: 10}}>
                <Button title={"Remove Card"} color={colors[index]} onPress={()=>this.state.carousel.removeIndex(index)}/>
            </View>
        </View>

    };
    setCarouselRef = (carousel) => {
        if ( !carousel ) return;
        this.setState({carousel});
    };
    keyExtractor = (item, index) => {
        return `card-${item.id}`;
    };

    onSnapToItem = index => {
        console.log(`Card snap to index`);
        this.setState({activeIndex: index});
        this.currentIndex = index;
    };


    render() {
        return <View style={styles.container}>
            {/*<Button title={"Jump to 4"} onPress={()=>this.carousel.snapToItem(4)}/>*/}
            <CardCarousel
                ref={this.setCarouselRef}
                containerCustomStyle={styles.slider}
                contentContainerCustomStyle={styles.slideInnerContainer}
                data={data}
                renderItem={this.renderItem}
                keyExtractor={this.keyExtractor}
                onSnapToItem={this.onSnapToItem}
            />
            <View style={{
                position: "absolute",
                height: 63,
                bottom: 0,
                right: 0,
                left: 0,
                alignItems: "center"
            }}>

                <Pagination
                    dotsData={data}
                    dotsLength={data.length}
                    activeDotIndex={this.state.activeIndex}
                    carouselRef={this.state.carousel}
                    // tappableDots={true}
                    dotTotalWidth={25}
                    nextPaginationJump={25}
                    maxWidth={viewportWidth - 37}
                    dotAction={(index)=>{
                        this.setState({activeIndex: index});
                        this.state.carousel.snapToItem(index);
                    }}
                    pickedColor={function(index, dispose) {
                        return this.setState({backgroundColor: colors[index]});
                    }}
                    containerStyle={{
                        backgroundColor: "transparent",
                        padding: 0,
                        justifyContent: "flex-start",
                        // maxWidth: this.props.maxWidth,
                        overflow: "hidden"
                    }}
                    dotContainerStyle={{
                        paddingHorizontal: 5,
                        margin: 0
                    }}
                    dotStyle={{
                        width: 15,
                        height: 15,
                        padding: 0,
                        margin: 0,
                        borderRadius: 8,
                        borderWidth: 0,
                        backgroundColor: "rgba(255, 255, 255, 0.92)",
                        borderColor: "rgba(255, 255, 255, 0.92)"
                    }}
                    inactiveDotStyle={{}}
                    inactiveDotOpacity={0.8}
                    inactiveDotScale={0.6}
                />
            </View>
        </View>;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 30,
    },
    slider: {
        marginTop: 20,
        marginBottom: 35
    },
    slideInnerContainer: {
        paddingBottom: 28 // needed for shadow
    },
});
