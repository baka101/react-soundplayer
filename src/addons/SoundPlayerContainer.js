import React from 'react/addons';
import SoundCloudAudio from 'soundcloud-audio';
import assign from 'object-assign';

import { stopAllOther, addToPlayedStore } from '../utils/audioStore.js';

let { PropTypes, Component } = React;
let { cloneWithProps } = React.addons;

class SoundPlayerContainer extends Component {
    constructor(props, context) {
        super(props, context);

        if (!props.clientId) {
            throw new Error(
                `You need to get clientId from SoundCloud
                https://github.com/soundblogs/react-soundplayer#usage`
            );
        }

        // Don't create a SoundCloudAudio instance
        // if there is no `window`
        if ('undefined' !== typeof window) {
            this.soundCloudAudio = new SoundCloudAudio(props.clientId);
        }

        this.state = {
            duration: 0,
            currentTime: 0,
            seeking: false,
            playing: false
        };
        this.wrapChild = this.wrapChild.bind(this);
    }

    getChildContext() {
        return {
            soundCloudAudio: this.soundCloudAudio
        };
    }

    componentDidMount() {
        const { soundCloudAudio } = this;
        const { resolveUrl, streamUrl } = this.props;

        if (streamUrl) {
            soundCloudAudio.preload(streamUrl);
        } else if (resolveUrl) {
            soundCloudAudio.resolve(resolveUrl, (data) => {
                this.setState({
                    [data.tracks ? 'playlist' : 'track']: data
                });
            });
        }

        // https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Media_events
        soundCloudAudio.on('playing', this.onAudioStarted.bind(this));
        soundCloudAudio.on('timeupdate', this.getCurrentTime.bind(this));
        soundCloudAudio.on('loadedmetadata', this.getDuration.bind(this));
        soundCloudAudio.on('seeking', this.onSeekingTrack.bind(this));
        soundCloudAudio.on('seeked', this.onSeekedTrack.bind(this));
        soundCloudAudio.on('pause', this.onAudioEnded.bind(this));
        soundCloudAudio.on('ended', this.onAudioEnded.bind(this));
    }

    componentWillReceiveProps(nextProps) {
        const { soundCloudAudio } = this;
        const { streamUrl, resolveUrl } = this.props;
        const playedBefore = this.state.playing;

        function restartIfPlayed () {
            if (playedBefore) {
                soundCloudAudio.play();
            }
        }

        if (streamUrl !== nextProps.streamUrl) {
            soundCloudAudio.stop();
            soundCloudAudio.preload(nextProps.streamUrl);
            restartIfPlayed();
        } else if (resolveUrl !== nextProps.resolveUrl) {
            soundCloudAudio.stop();
            soundCloudAudio.resolve(nextProps.resolveUrl, (data) => {
                this.setState({
                    [data.tracks ? 'playlist' : 'track']: data
                });
                restartIfPlayed();
            });
        }
    }

    componentWillUnmount() {
        this.soundCloudAudio.unbindAll();
    }

    onSeekingTrack() {
        this.setState({seeking: true});
    }

    onSeekedTrack() {
        this.setState({seeking: false});
    }

    onAudioStarted() {
        const { soundCloudAudio } = this;
        const { onStartTrack } = this.props;

        this.setState({playing: true});

        stopAllOther(soundCloudAudio.playing);
        addToPlayedStore(soundCloudAudio);

        onStartTrack && onStartTrack(soundCloudAudio, soundCloudAudio.playing);
    }

    onAudioEnded() {
        const { onStopTrack } = this.props;
        this.setState({playing: false});

        onStopTrack && onStopTrack(this.soundCloudAudio);
    }

    getCurrentTime() {
        this.setState({currentTime: this.soundCloudAudio.audio.currentTime});
    }

    getDuration() {
        this.setState({duration: this.soundCloudAudio.audio.duration});
    }

    wrapChild(child) {
        const newProps = assign({}, { soundCloudAudio: this.soundCloudAudio }, this.state);
        return cloneWithProps(child, newProps);
    }

    render() {
        const { children } = this.props;

        if (!children) {
            return null;
        }

        if (!Array.isArray(children)) {
            const child = children;
            return this.wrapChild(child);
        } else {
            return (
                <span>
                    {React.Children.map(children, this.wrapChild)}
                </span>
            );
        }
    }
}

SoundPlayerContainer.propTypes = {
    streamUrl: PropTypes.string,
    resolveUrl: PropTypes.string,
    clientId: PropTypes.string.isRequired,
    onStartTrack: PropTypes.func,
    onStopTrack: PropTypes.func
};

export default SoundPlayerContainer;
