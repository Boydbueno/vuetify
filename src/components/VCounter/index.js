import VCounter from './VCounter'

/* istanbul ignore next */
VCounter.install = function install (Vue) {
  Vue.component(VCounter.name, VCounter)
}

export default VCounter
