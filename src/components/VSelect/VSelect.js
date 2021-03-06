// Styles
import '../../stylus/components/_text-fields.styl'
import '../../stylus/components/_select.styl'

// Components
import VChip from '../VChip'
import VMenu from '../VMenu'
import VSelectList from './VSelectList'

// Extensions
import VTextField from '../VTextField/VTextField'

// Mixins
import Comparable from '../../mixins/comparable'
import Dependent from '../../mixins/dependent'
import Filterable from '../../mixins/filterable'
import Menuable from '../../mixins/menuable'

// Directives
import ClickOutside from '../../directives/click-outside'

// Helpers
import { getPropertyFromItem, keyCodes } from '../../util/helpers'
import { consoleError } from '../../util/console'

export default {
  name: 'v-select',

  extends: VTextField,

  directives: {
    ClickOutside
  },

  mixins: [
    Comparable,
    Dependent,
    Filterable
  ],

  data: vm => ({
    attrsInput: { role: 'combobox' },
    cachedItems: vm.cacheItems ? vm.items : [],
    content: null,
    isBooted: false,
    isMenuActive: false,
    lastItem: 20,
    // As long as a value is defined, show it
    // Otherwise, check if multiple
    // to determine which default to provide
    lazyValue: vm.value != null
      ? vm.value
      : vm.multiple ? [] : undefined,
    selectedIndex: -1,
    selectedItems: []
  }),

  props: {
    ...VMenu.props, // TODO: remove some, just for testing,
    ...Menuable.props,
    appendIcon: {
      type: String,
      default: '$vuetify.icons.dropdown'
    },
    appendIconCb: Function,
    attach: Boolean,
    auto: Boolean,
    browserAutocomplete: {
      type: String,
      default: 'on'
    },
    cacheItems: Boolean,
    chips: Boolean,
    clearable: Boolean,
    contentClass: String,
    deletableChips: Boolean,
    dense: Boolean,
    hideNoData: Boolean,
    hideSelected: Boolean,
    items: {
      type: Array,
      default: () => []
    },
    itemAvatar: {
      type: [String, Array, Function],
      default: 'avatar'
    },
    itemDisabled: {
      type: [String, Array, Function],
      default: 'disabled'
    },
    itemText: {
      type: [String, Array, Function],
      default: 'text'
    },
    itemValue: {
      type: [String, Array, Function],
      default: 'value'
    },
    maxHeight: {
      type: [Number, String],
      default: 300
    },
    minWidth: {
      type: [Boolean, Number, String],
      default: 0
    },
    multiple: Boolean,
    multiLine: Boolean,
    openOnClear: Boolean,
    returnObject: Boolean,
    searchInput: {
      default: null
    },
    smallChips: Boolean,
    singleLine: Boolean
  },

  computed: {
    classes () {
      return Object.assign({}, VTextField.computed.classes.call(this), {
        'v-select': true,
        'v-select--chips': this.chips,
        'v-select--is-menu-active': this.isMenuActive
      })
    },
    computedItems () {
      return this.filterDuplicates(this.cachedItems.concat(this.items))
    },
    directives () {
      return [{
        name: 'click-outside',
        // TODO: Check into this firing when it shouldn't
        value: e => {
          if (this.isMenuActive) {
            this.onKeyDown(e)
          }

          this.isMenuActive = false
          this.isFocused = false
          this.selectedIndex = -1
        },
        args: {
          closeConditional: e => {
            return !this.$refs.menu.$refs.content.contains(e.target) &&
              !this.$el.contains(e.target) &&
              e.target !== this.$el
          }
        }
      }]
    },
    dynamicHeight () {
      return 'auto'
    },
    hasSlot () {
      return Boolean(this.chips || this.$slots.item)
    },
    isDirty () {
      return this.selectedItems.length > 0
    },
    isMulti () {
      return this.multiple
    },
    menuProps () {
      return {
        closeOnClick: false,
        closeOnContentClick: false,
        openOnClick: false,
        value: this.isMenuActive,
        offsetY: this.offsetY,
        nudgeBottom: this.offsetY ? 1 : 0 // convert to int
      }
    },
    listData () {
      return {
        props: {
          action: this.isMulti && !this.isHidingSelected,
          color: this.color,
          dark: this.dark,
          dense: this.dense,
          hideSelected: this.hideSelected,
          items: this.virtualizedItems,
          light: this.light,
          noDataText: this.noDataText,
          selectedItems: this.selectedItems,
          itemAvatar: this.itemAvatar,
          itemDisabled: this.itemDisabled,
          itemValue: this.itemValue,
          itemText: this.itemText
        },
        on: {
          select: this.selectItem
        },
        scopedSlots: {
          item: this.$scopedSlots.item
        }
      }
    },
    staticList () {
      if (this.$slots['no-data']) {
        consoleError('assert: staticList should not be called if slots are used')
      }

      return this.$createElement(VSelectList, this.listData)
    },
    virtualizedItems () {
      return !this.auto
        ? this.computedItems.slice(0, this.lastItem)
        : this.computedItems
    }
  },

  watch: {
    internalValue: 'setSelectedItems',
    isBooted () {
      this.$nextTick(() => {
        if (this.content && this.content.addEventListener) {
          this.content.addEventListener('scroll', this.onScroll, false)
        }
      })
    },
    isMenuActive (val) {
      if (!val) return

      this.isBooted = true
    },
    items (val) {
      if (this.cacheItems) {
        this.cachedItems = this.filterDuplicates(this.cachedItems.concat(val))
      }

      this.setSelectedItems()
    }
  },

  created () {
    this.setSelectedItems()
  },

  mounted () {
    // If instance is being destroyed
    // do not run mounted functions
    if (this._isDestroyed) return

    this.content = this.$refs.menu.$refs.content
  },

  methods: {
    clearableCallback () {
      this.internalValue = this.isMulti ? [] : null
      this.$emit('change', this.internalValue)
      this.$nextTick(() => this.$refs.input.focus())

      if (this.openOnClear) this.isMenuActive = true
    },
    filterDuplicates (arr) {
      const uniqueValues = new Map()
      for (let index = 0; index < arr.length; ++index) {
        const item = arr[index]
        const val = this.getValue(item)

        // TODO: comparator
        !uniqueValues.has(val) && uniqueValues.set(val, item)
      }
      return Array.from(uniqueValues.values())
    },
    findExistingIndex (item) {
      const itemValue = this.getValue(item)

      return (this.internalValue || []).findIndex(i => this.valueComparator(this.getValue(i), itemValue))
    },
    genChipSelection (item, index) {
      const isDisabled = (
        this.disabled ||
        this.readonly ||
        this.getDisabled(item)
      )
      const focus = (e, cb) => {
        if (isDisabled) return

        e.stopPropagation()
        this.onFocus()
        cb && cb()
      }

      return this.$createElement(VChip, {
        staticClass: 'v-chip--select-multi',
        props: {
          close: this.deletableChips && !isDisabled,
          dark: this.dark,
          disabled: isDisabled,
          selected: index === this.selectedIndex,
          small: this.smallChips
        },
        on: {
          click: e => {
            focus(e, () => {
              this.selectedIndex = index
            })
          },
          focus,
          input: () => this.onChipInput(item)
        },
        key: this.getValue(item)
      }, this.getText(item))
    },
    genCommaSelection (item, index, last) {
      // Item may be an object
      // TODO: Remove JSON.stringify
      const key = JSON.stringify(this.getValue(item))

      const isDisabled = (
        this.disabled ||
        this.readonly ||
        this.getDisabled(item)
      )

      const classes = index === this.selectedIndex
        ? this.addTextColorClassChecks()
        : {}

      classes['v-select__selection--disabled'] = isDisabled

      return this.$createElement('div', {
        staticClass: 'v-select__selection v-select__selection--comma',
        'class': classes,
        key
      }, `${this.getText(item)}${last ? '' : ', '}`)
    },
    genDefaultSlot () {
      const selections = this.genSelections()
      const input = this.genInput()

      // If the return is an empty array
      // push the input
      if (Array.isArray(selections)) {
        selections.push(input)
      // Otherwise push it into children
      } else {
        selections.children = selections.children || []
        selections.children.push(input)
      }

      const activator = this.genSelectSlot([
        this.genLabel(),
        this.prefix ? this.genAffix('prefix') : null,
        selections,
        this.suffix ? this.genAffix('suffix') : null,
        this.genClearIcon(),
        this.genSlot('append', 'inner', [this.genIcon('append')])
      ])

      return [this.genMenu(activator)]
    },
    genInput () {
      const input = VTextField.methods.genInput.call(this)

      input.data.domProps.value = null

      return input
    },
    genList () {
      // If there's no slots, we can use a cached VNode to improve performance
      if (this.$slots['no-data']) {
        return this.genListWithSlot()
      } else {
        return this.staticList
      }
    },
    genListWithSlot () {
      return this.$createElement(VSelectList, this.listData, [
        this.$slots['no-data'] ? this.$createElement('div', {
          slot: 'no-data'
        }, this.$slots['no-data']) : null
      ])
    },
    genMenu (activator) {
      const props = {
        contentClass: this.contentClass
      }
      const inheritedProps = Object.keys(VMenu.props).concat(Object.keys(Menuable.props))

      // Later this might be filtered
      for (let prop of inheritedProps) {
        props[prop] = this[prop]
      }

      // These styles encompass the prepend
      // and append icons. Change activator
      // to the entire component
      if (this.isSolo) {
        props.activator = this.$el
      } else {
        props.activator = this.$refs['input-slot']
      }

      Object.assign(props, this.menuProps)

      // Attach to root el so that
      // menu covers prepend/append icons
      if (
        // TODO: make this a computed property or helper or something
        this.attach === '' || // If used as a boolean prop (<v-menu attach>)
        this.attach === true || // If bound to a boolean (<v-menu :attach="true">)
        this.attach === 'attach' // If bound as boolean prop in pug (v-menu(attach))
      ) {
        props.attach = this.$el
      }

      return this.$createElement(VMenu, {
        props,
        on: {
          input: val => {
            this.isMenuActive = val
            this.isFocused = val
          }
        },
        ref: 'menu'
      }, [activator, this.genList()])
    },
    genSelections () {
      let length = this.selectedItems.length
      const children = new Array(length)

      let genSelection
      if (this.$scopedSlots.selection) {
        genSelection = this.genSlotSelection
      } else if (this.chips) {
        genSelection = this.genChipSelection
      } else {
        genSelection = this.genCommaSelection
      }

      while (length--) {
        children[length] = genSelection(
          this.selectedItems[length],
          length,
          length === children.length - 1
        )
      }

      return this.$createElement('div', {
        staticClass: 'v-select__selections'
      }, children)
    },
    genSelectSlot (children) {
      return this.$createElement('div', {
        staticClass: 'v-select__slot',
        directives: this.directives,
        slot: 'activator'
      }, children)
    },
    genSlotSelection (item, index) {
      return this.$scopedSlots.selection({
        parent: this,
        item,
        index,
        selected: index === this.selectedIndex,
        disabled: this.disabled || this.readonly
      })
    },
    getMenuIndex () {
      return this.$refs.menu ? this.$refs.menu.listIndex : -1
    },
    getDisabled (item) {
      return getPropertyFromItem(item, this.itemDisabled, false)
    },
    getText (item) {
      return getPropertyFromItem(item, this.itemText, item)
    },
    getValue (item) {
      return getPropertyFromItem(item, this.itemValue, item)
    },
    onBlur (e) {
      this.$emit('blur', e)
    },
    onChipInput (item) {
      if (this.isMulti) this.selectItem(item)
      else this.internalValue = null

      // If all items have been deleted,
      // open `v-menu`
      if (this.selectedItems.length === 0) {
        this.isMenuActive = true
      }

      this.selectedIndex = -1
    },
    onClick () {
      if (this.isDisabled) return

      this.onFocus()
      this.isMenuActive = true
    },
    // Detect tab and call original onBlur method
    onKeyDown (e) {
      if (e.keyCode === keyCodes.tab) {
        VTextField.methods.onBlur.call(this, e)
      } else if ([
        keyCodes.enter,
        keyCodes.space,
        keyCodes.up,
        keyCodes.down
      ].includes(e.keyCode)) {
        this.isMenuActive = true
      }
    },
    onMouseUp (e) {
      const appendInner = this.$refs['append-inner']

      // If append inner is present
      // and the target is itself
      // or inside, toggle menu
      if (this.isMenuActive &&
        appendInner &&
        (appendInner === e.target ||
        appendInner.contains(e.target))
      ) {
        this.$nextTick(() => (this.isMenuActive = !this.isMenuActive))
      // If user is clicking in the container
      // and field is enclosed, activate it
      } else if (this.isEnclosed) {
        this.isMenuActive = true
      }

      VTextField.methods.onMouseUp.call(this, e)
    },
    onScroll () {
      if (!this.isMenuActive) {
        requestAnimationFrame(() => (this.content.scrollTop = 0))
      } else {
        if (this.lastItem >= this.computedItems.length) return

        const showMoreItems = (
          this.content.scrollHeight -
          (this.content.scrollTop +
          this.content.clientHeight)
        ) < 200

        if (showMoreItems) {
          this.lastItem += 20
        }
      }
    },
    selectItem (item) {
      if (!this.isMulti) {
        this.internalValue = this.returnObject ? item : this.getValue(item)
        this.isMenuActive = false
      } else {
        const internalValue = (this.internalValue || []).slice()
        const i = this.findExistingIndex(item)

        i !== -1 ? internalValue.splice(i, 1) : internalValue.push(item)
        this.internalValue = internalValue.map(i => {
          return this.returnObject ? i : this.getValue(i)
        })
      }

      this.$emit('change', this.internalValue)

      this.$nextTick(() => {
        this.$refs.menu &&
          this.$refs.menu.updateDimensions()
      })
    },
    setMenuIndex (index) {
      this.$refs.menu && (this.$refs.menu.listIndex = index)
    },
    setSelectedItems () {
      const fn = !this.isMulti
        ? i => this.valueComparator(
          this.getValue(i),
          this.getValue(this.internalValue)
        )
        : i => this.findExistingIndex(i) > -1

      this.selectedItems = this.computedItems.filter(fn)
    }
  }
}
