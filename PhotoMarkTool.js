
/**
 * 基于shadowRoot和css3的pointer-events事件穿透属性和opacity透明属性 实现的水印工具
 * @author JuniorRay
 * @date 2019-12-08
 * 调用方式：
 1.定时器调用
 setInterval(function () {
            window.photoMarkTool = null;//释放内存防止内存泄漏
            window.photoMarkTool = new PhotoMarkTool();
            window.photoMarkTool.removeAll();//权限级别最高，影响所有实例化元素
            var showMarkText = "水印内容" ;
            showMarkText = showMarkText+"<br/>"+"时间：";
            window.photoMarkTool.load({
                parentElement: ".parent-class",//被渲染元素，支持"#id",".className"
                content:  showMarkText  + new Date(),
                width: 100,
                height:50,
                color:'#ffffff',//水印字体颜色
                fontSize:"8px",
                isParentIdNotExistToLoadAtBody:true,//要渲染的元素parentElement找不到时是否挂载到body上面
            });

 }, 1*1000); //每1秒刷新一次  1000的单位是毫秒


 2.静态调用：

 var photoMarkTool = new PhotoMarkTool();//每个实例化对象，只能影响到自己，和其他对象互不影响
 photoMarkTool.load({
            parentElement: "."+className,//被渲染元素，支持"#id",".className"
            content:  "通过class选择加载水印" + new Date(),
            width: 100,//水印小块宽度
            height:50,//水印小块高度
            color:'#ffffff',//水印字体颜色
            fontSize:"8px",
            isParentIdNotExistToLoadAtBody:false,//要渲染的元素parentElement找不到时是否挂载到body上面
 });
 //移除水印
 photoMarkTool.remove();//每个实例化对象，只能移除到自己，和其他对象互不影响

 //移除全部水印，暴力模式，权限级别最高
 photoMarkTool.removeAll();//可以影响到所有的实例化对象
 **/
(function (root,factory){

    if (typeof define === 'function' && define.amd) {
        /*AMD. Register as an anonymous module.
        *define([], factory); */
        define([], factory());
    } else if (typeof module === 'object' && module.exports) {
        /*Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.*/
        module.exports = factory();

    } else {
        /*Browser globals (root is window)*/
        root['PhotoMarkTool'] = factory();
    }
}(this, function () {
    "use strict";
    /*Just return a value to define the module export.*/
    /**拓展startsWidth 兼容IE**/
    if(typeof String.startsWidth!= 'function'){
        String.prototype.startsWith=function(str){
            if(str==null||str==""||this.length==0||str.length>this.length)
                return false;
            if(this.substr(0,str.length)==str)
                return true;
            else
                return false;
            return true;
        }
    }
    /**拓展Array.from 兼容IE**/
    if(!Array.from){
        Array.from = function(iterable){
            // IE(包括IE11)没有这个方法,用[].slice.call(new Uint8Array..代替
            return [].slice.call(new Uint8Array(iterable));
        }
    }
    var registerListenEvent =null ;//事件监听函数i，因为匿名函数无法移除，必须要有名函数
    var tempSetting = null;//如果没有此临时存储，移除监听时将找不到是同一个函数
    var currentThat =null;//记录当前实例化的new PhotoMarkTool() 对象
    var PhotoMarkTool = function () {
        this.name = "JuniorRay";
        this.defaultSettings={
            parentWidth:0,      //水印的总体宽度（默认值：body的scrollWidth和clientWidth的较大值）
            parentHeight:0,     //水印的总体高度（默认值：body的scrollHeight和clientHeight的较大值）
            parentElement:null,    //水印插件挂载的父元素element,不输入则默认挂在body上
            content:"Junior测试水印内容",      //水印小块的内容
            isParentIdNotExistToLoadAtBody:false,//如果挂载的父元素element找不到，是否挂载到body元素
            plugWrapName: 'photoMarkToolsPlug',          //内部生产水印DOM总体的id,防止重复
            plugWrapClassName: 'photoMarkToolsWrap',          //内部生产水印DOM总体的ClassName
            childrenPrefixId: 'photoMark-',    //水印小块的id前缀
            x:20,                     //水印小块起始位置x轴坐标
            y:20,                     //水印小块起始位置Y轴坐标
            rows:0,                   //水印行数
            cols:0,                   //水印列数
            xSpace:50,              //水印x轴间隔
            ySpace:50,               //水印y轴间隔
            fontFamily:'微软雅黑',           //水印小块字体
            // color:'#85B6FF',       //水印小块字体颜色
            color:'#aaa',            //水印小块字体颜色
            fontSize:'18px',          //水印小块字体大小
            opacity:0.35,               //水印透明度，要求设置在大于等于0.005
            width:100,                //水印小块的宽度
            height:100,               //水印小块长度
            angle:15,                 //水印小块倾斜度数

        };
        this.extendsDefaultSetting = function(settings){
            /*采用配置项替换默认值，作用类似jquery.extend*/
            if (arguments.length === 1 && typeof arguments[0] === "object") {
                var src = arguments[0] || {};
                for (var key in src) {
                    if (src[key] && this.defaultSettings[key] && src[key] === this.defaultSettings[key]) {
                        continue;
                        /*veronic: resolution of angle=0 not in force*/
                    } else if (src[key] || src[key] === 0) {
                        this.defaultSettings[key] = src[key];
                    }
                }
            }
        }
        /**渲染模式，支持body，id，class**/
        this.renderModes = {"idMode":"idMode","classMode":"classMode","bodyMode":"bodyMode"};
        /**当前渲染模式**/
        this.currentConfig = {
            mode:"bodyMode",//当前渲染的模式,默认渲染body模式
        }

        /**记录渲染记录的页面**/
        this.renderPageHistoryData = {
            classModePlugsLoadInPageIdMap:new Map(),//当前classMode渲染模式生产的水印插件id集合,map里面为map==>{parentId：plugId-random}
            idModePlugsLoadInPageIdMap:new Map(),//当前IdMode渲染模式生产的水印插件id集合{parentClassName：[plugId-random]}
            bodyModePlugsLoadInPageIdMap: new Map()//当前bodyMode渲染模式生产的水印插件id集合
        }

    };

    /**
     * @Description:加载水印
     * @Author: Junior Ray
     * @Date: 2020/8/11 16:54
     * @param settings
     * settings 形如：
     * {
            parentElement: "."+className,//被渲染元素，支持"#id",".className"
            content:  "通过class选择加载水印" + new Date(),
            width: 100,//水印小块宽度
            height:50,//水印小块高度
            color:'#ffffff',//水印字体颜色
            fontSize:"8px",
            isParentIdNotExistToLoadAtBody:false,//要渲染的元素parentElement找不到时是否挂载到body上面

        };
     * @return
     */
    PhotoMarkTool.prototype.load = function(settings) {
        loadMark(settings,this);
    };

    /**
     * @Description:移除当前对象产生的水印
     * 只有自己new 出来的对象从才能移除自己的操作，不影响他人的的对象操作！！！
     * @Author: Junior Ray
     * @Date: 2020/8/11 16:59
     * @param null
     * @return
     */
    PhotoMarkTool.prototype.remove = function() {
        /**移除事件监听**/
        removeListen();
        /**移除自己模式下的历史数据**/
        removeSelfModeDateAndDom(this);
    };

    /**
     * @Description:移除页面所有水印
     * 任何new 出来的实例对象都能操作，权限级别顶级！！！
     * @Author: Junior Ray
     * @Date: 2020/8/11 17:00
     * @param null
     * @return:
     */
    PhotoMarkTool.prototype.removeAll = function() {
        //移除事件监听
        removeListen();
        /*移除所有水印*/
        isExitThenRemoveByClass(this.defaultSettings.plugWrapClassName);
        /**清空记录渲染记录的页面**/
        this.renderPageHistoryData = {
            classModePlugsLoadInPageIdMap:new Map(),//当前classMode渲染模式生产的水印插件id集合
            idModePlugsLoadInPageIdMap:new Map(),//当前IdMode渲染模式生产的水印插件id集合
            bodyModePlugsLoadInPageIdMap: new Map()//当前bodyMode渲染模式生产的水印插件id集合
        }
    };

    /**加载水印**/
    function loadMark(settings,that) {
        /**采用配置项替换默认值，作用类似jquery.extend**/
        that.extendsDefaultSetting(settings);
        /**添加监听**/
        addListen(that.defaultSettings,that);

        var parentDom = null;
        /**判断是通过id还是class传入设置水印的父元素挂载**/
        var elementClassNameOrId = that.defaultSettings.parentElement;
        if ((elementClassNameOrId+"").startsWith("#")) {
            /**自动去除#号**/
            var elementName = elementClassNameOrId.substr(1, elementClassNameOrId.length - 1);
            parentDom = document.getElementById(elementName);
            that.currentConfig.mode = that.renderModes.idMode;
        } else if (elementClassNameOrId+"".startsWith(".")) {
            /**自动去除.号**/
            var elementName = elementClassNameOrId.substr(1, elementClassNameOrId.length - 1);
            parentDom = document.getElementsByClassName(elementName);//数组
            that.currentConfig.mode = that.renderModes.classMode;
        } else {
            parentDom = null;
        }

        var rootDom = null;

        /**判断是否document。getXXX为空元素的[]数组**/
        function isBlankHtmlCollection(t){
            /**判断document。getXXX空元素的[]数组**/
            if( t instanceof HTMLCollection){
                if(t.length>0){
                    return false
                }else{
                    return true
                }
            }
            return false
        }
        /**设置水印插件挂载的节点**/
        if (!isBlank(parentDom) && !isBlankHtmlCollection(parentDom)) {
            rootDom = parentDom;
            /**如果是class查找，那么查找结果就是个数组**/
            if(that.currentConfig.mode == that.renderModes.classMode){
                /**如果存在当前自己class创建的所有插件，则先移除，然后创建插件**/
                var oldPlugIdsArray = that.renderPageHistoryData.classModePlugsLoadInPageIdMap.get(settings.parentElement);//获取当前模式的Map
                if(!isBlank(oldPlugIdsArray)){
                    /**强转数组**/
                    oldPlugIdsArray = Array.from(oldPlugIdsArray);
                    oldPlugIdsArray.forEach(function (value,index) {
                        isExitThenRemoveById(value);
                    })
                }
                /**然后创建新的水印**/
                var plugIdsArray = new Array();
                /**强转数组**/
                var rootDomArray = Array.from(rootDom);
                rootDomArray.forEach(function(value,index){
                    var plugId = createMark(settings,value,that);
                    plugIdsArray.push(plugId);
                })
                that.renderPageHistoryData.classModePlugsLoadInPageIdMap.set(settings.parentElement,plugIdsArray);//加入当前模式的Map
            }else{//id 查找模式
                /**创建水印之前先清除自己模式下，历史创建的信息**/
                var oldPlugId = that.renderPageHistoryData.idModePlugsLoadInPageIdMap.get(settings.parentElement);
                isExitThenRemoveById(oldPlugId);
                var plugId = createMark(settings,rootDom,that);
                that.renderPageHistoryData.idModePlugsLoadInPageIdMap.set(settings.parentElement,plugId);//加入当前模式的Map
            }
        } else {/**parentDom元素未找到**/
            //如果父元素不存在是否挂载到body上
            if (that.defaultSettings.isParentIdNotExistToLoadAtBody) {
                // console.warn("水印插件工具未找到要挂载水印插件的父节点元素:" + that.defaultSettings.parentElement + "。将自动挂载到body上");
                rootDom = document.body;
                that.currentConfig.mode = that.renderModes.bodyMode;
                /**创建水印之前先清除自己模式下历史创建的信息**/
                var oldPlugId = that.renderPageHistoryData.bodyModePlugsLoadInPageIdMap.get("body");
                isExitThenRemoveById(oldPlugId);
                /**然后开始创建水印**/
                var plugId = createMark(settings,rootDom,that);
                that.renderPageHistoryData.bodyModePlugsLoadInPageIdMap.set("body",plugId);//加入当前模式的数组
                return;
            } else {/**什么也不做**/
                // console.warn("水印插件工具未找到要挂载水印插件的父节点元素:" + that.defaultSettings.parentElement + "。请传入");
                return;
            }
        }
    }
    /**通过id判断如果存在然后移除插件**/
    function isExitThenRemoveById(plugWrapName){
        /**如果传进来带#号，则自动去掉#号**/
        if ((plugWrapName+"").startsWith("#")) {
            plugWrapName = plugWrapName.substr(1, plugWrapName.length - 1);
        }
        /*如果元素存在则移除*/
        var plugDom = document.getElementById(plugWrapName);
        if (!isBlank(plugDom)) {
            var parentElement = plugDom.parentNode;
            if (parentElement) {
                parentElement.removeChild(plugDom);
            }
        }
    }
    /**通过className判断如果存在然后移除插件**/
    function isExitThenRemoveByClass(plugWrapClassName){
        /**如果传进来带.号，则自动去掉.号**/
        if ((plugWrapClassName+"").startsWith(".")) {
            plugWrapClassName = plugWrapClassName.substr(1, plugWrapClassName.length - 1);
        }
        /*如果元素存在则移除*/
        var plugDom = document.getElementsByClassName(plugWrapClassName);
        if (!isBlank(plugDom)) {
            var plugArray =  Array.from(plugDom);
            plugArray.forEach(function (value, index, array) {
                value.remove();
            })
        }

    }
    /**判空工具**/
    function isBlank(t) {
        if(t==null||t=="undefined"||t==undefined||t==""||t=='NaN'){
            return true;
        }else{
            if((t+'').trim()==""){
                return true;
            }
            //空对象 isOwnEmpty(obj)
            function isEmptyObject(t){

                for(var key in t){
                    return false
                }
                return true
            }
            try {

                if(typeof(t)=="object"){
                    return  isEmptyObject(t);
                }
            }catch (e) {
                return false;
            }

            return false;
        }
    }
    /**移除自己模式下的历史数据**/
    function removeSelfModeDateAndDom(that){
        var settings = that.defaultSettings;
        if(that.currentConfig.mode == that.renderModes.classMode){
            /**如果存在当前自己class创建的所有插件，则先移除，然后创建插件**/
            var oldPlugIdsArray = that.renderPageHistoryData.classModePlugsLoadInPageIdMap.get(settings.parentElement);//获取当前模式的Map

            if(!isBlank(oldPlugIdsArray)){
                /**强转数组**/
                oldPlugIdsArray = Array.from(oldPlugIdsArray);
                oldPlugIdsArray.forEach(function (value,index) {
                    isExitThenRemoveById(value);
                })
            }
            /**删除旧数据**/
            that.renderPageHistoryData.classModePlugsLoadInPageIdMap.delete(settings.parentElement);//获取当前模式的Map

        }else if(that.currentConfig.mode == that.renderModes.idMode){//id 查找模式
            /**创建水印之前先清除自己模式下，历史创建的信息**/
            var oldPlugId = that.renderPageHistoryData.idModePlugsLoadInPageIdMap.get(settings.parentElement);
            isExitThenRemoveById(oldPlugId);
            /**删除旧数据**/
            that.renderPageHistoryData.idModePlugsLoadInPageIdMap.delete(settings.parentElement);//获取当前模式的Map
        }else{//body model
            /**创建水印之前先清除自己模式下历史创建的信息**/
            var oldPlugId = that.renderPageHistoryData.bodyModePlugsLoadInPageIdMap.get("body");
            if(!isBlank(oldPlugId)){
                isExitThenRemoveById(oldPlugId);
            }
            /**删除旧数据**/
            that.renderPageHistoryData.bodyModePlugsLoadInPageIdMap.delete("body");//获取当前模式的Map
        }
    }
    /**
     * @Description:创造水印
     * @Author: Junior Ray
     * @Date: 2020/8/11 14:42
     * @param settings
     * @param rootDom
     * @param that
     * @return: plugId
     */
    function createMark(settings,rootDom,that){
        /*获取页面宽度*/
        // var pageWidth = Math.max(rootDom.scrollWidth,rootDom.clientWidth) - that.defaultSettings.width/2;
        var pageWidth = Math.max(rootDom.scrollWidth, rootDom.clientWidth);
        /*获取页面最大长度*/
        // var pageHeight = Math.max(rootDom.scrollHeight,rootDom.clientHeight,document.documentElement.clientHeight)-that.defaultSettings.height/2;
        var pageHeight = Math.max(rootDom.scrollHeight, rootDom.clientHeight);
        /**
         * 修改源码添加pageHeight为0时增加默认值
         * @author JuniorRay
         * @date 2019-12-08
         * **/
        var fullScreenFlag = false;//是否全屏
        if (pageHeight == 0) {
            var fullDom = document.body.getElementsByTagName("div")[0];//获取body的第一个div。因为我们的项目是全屏占比
            pageHeight = window.getComputedStyle(fullDom).height;
            pageHeight = pageHeight.replace("px", "");
            fullScreenFlag = true;
        }
        /**结束**/
            //
        var setting = arguments[0] || {};
        var parentEle = rootDom;

        var pageOffsetTop = 0;
        var pageOffsetLeft = 0;
        if (setting.parentWidth || setting.parentHeight) {
            /*指定父元素同时指定了宽或高*/
            if (parentEle) {
                pageOffsetTop = parentEle.offsetTop || 0;
                pageOffsetLeft = parentEle.offsetLeft || 0;
                that.defaultSettings.x = that.defaultSettings.x + pageOffsetLeft;
                that.defaultSettings.y = that.defaultSettings.y + pageOffsetTop;
            }
        } else {
            if (parentEle) {
                /**juniorRay 2020-8-10号发现水印工具在同时生成多个div加载水印的时候偏移量存在偏移严重于是改为clientTop和clientLeft***/
                // pageOffsetTop = parentEle.offsetTop || 0;
                // pageOffsetLeft = parentEle.offsetLeft || 0;
                pageOffsetTop = parentEle.clientTop || 0;
                pageOffsetLeft = parentEle.clientLeft || 0;

            }
        }

        /*三种情况下会重新计算水印列数和x方向水印间隔：1、水印列数设置为0，2、水印长度大于页面长度，3、水印长度小于于页面长度*/
        that.defaultSettings.cols = parseInt((pageWidth - that.defaultSettings.x) / (that.defaultSettings.width + that.defaultSettings.xSpace));
        var tempSpaceOfX = parseInt((pageWidth - that.defaultSettings.x - that.defaultSettings.width * that.defaultSettings.cols) / (that.defaultSettings.cols));
        that.defaultSettings.xSpace = tempSpaceOfX ? that.defaultSettings.xSpace : tempSpaceOfX;
        var allphotoMarkToolWidth = 0;
        if (!isBlank(rootDom)) {
            allphotoMarkToolWidth = that.defaultSettings.x + that.defaultSettings.width * that.defaultSettings.cols + that.defaultSettings.xSpace * (that.defaultSettings.cols - 1);
        } else {
            allphotoMarkToolWidth = pageOffsetLeft + that.defaultSettings.x + that.defaultSettings.width * that.defaultSettings.cols + that.defaultSettings.xSpace * (that.defaultSettings.cols - 1);
        }

        /*三种情况下会重新计算水印列数和y方向水印间隔：1、水印行数设置为0，2、水印长度大于页面长度，3、水印长度小于于页面长度*/
        that.defaultSettings.rows = Math.ceil((pageHeight - that.defaultSettings.y) / (that.defaultSettings.height + that.defaultSettings.ySpace));
        var tempSpaceOfY = Math.ceil((pageHeight - that.defaultSettings.y - that.defaultSettings.height * that.defaultSettings.rows) / (that.defaultSettings.rows));
        that.defaultSettings.ySpace = tempSpaceOfY ? that.defaultSettings.ySpace : tempSpaceOfY;
        var allphotoMarkToolHeight = that.defaultSettings.y + pageOffsetTop + that.defaultSettings.height * that.defaultSettings.rows + that.defaultSettings.ySpace * (that.defaultSettings.rows - 1);
        /**思想就是：旋转过后因为是平行四边形，取得的width都是原始width+height*tan(angle)**/
        var angle=that.defaultSettings.angle;//角度
        var radian=angle*Math.PI/180;//角度转弧度
        var tanWidth=allphotoMarkToolHeight*(Math.tan(radian));
        /**容器超过减少一行**/
        if(allphotoMarkToolHeight>parentEle.clientHeight){
            that.defaultSettings.rows = that.defaultSettings.rows - 1;
        }else{
            /**
             * 如果是全屏时减少一行，防止屏幕溢出，产生滚动条
             * @author JuniorRay
             * @date 2019-12-08
             * **/
            //
            if(fullScreenFlag){
                that.defaultSettings.rows = that.defaultSettings.rows - 1;
            }
        }


        /**结束**/
        /**shadowRoot标签**/
        var shadowRoot = null;
        /**创建水印外壳div**/
        var outerDiv = document.createElement('div');

        var randomNum = Math.floor(Math.random() * ((1000*1000*1000) - 1 ));
        var plugId = that.defaultSettings.plugWrapName+"-"+randomNum;

        /*创建shadow dom*/
        outerDiv.id = plugId;

        outerDiv.classList.add(that.defaultSettings.plugWrapClassName);
        /*  /!**
           * 如果是全屏时 全屏填充
           * @author JuniorRay
           * @date 2019-12-08
           * **!/
          //
          if(fullScreenFlag){
              outerDiv.style.width = "100%";
              outerDiv.style.height = "100%";
          }*/
        outerDiv.style.zIndex = "99999999";
        outerDiv.style.display = "block";
        outerDiv.style.pointerEvents = "none";

        /**如果是body查找,是id或者class查找，设置样式**/
        if( that.currentConfig.mode == that.renderModes.bodyMode){
            outerDiv.style.top = "0";
            outerDiv.style.position = "fixed";
            outerDiv.style.width = "100%";
            outerDiv.style.height = "100%";
        }else{
            outerDiv.style.position = "absolute";
        }

        /*判断浏览器是否支持attachShadow方法*/
        if (typeof outerDiv.attachShadow === 'function') {
            /* createShadowRoot Deprecated. Not for use in new websites. Use attachShadow*/
            shadowRoot = outerDiv.attachShadow({mode: 'open'});//如果支持标签则用该标签
        } else {
            shadowRoot = outerDiv;//如果不支持shadowRoot标签则创建的外壳就是自己
        }
        /**创建水印小块**/
        var photoMarkDivList = createPhotoMarkDivList({
            rootDom:rootDom,
            pageOffsetLeft:pageOffsetLeft,
            pageOffsetTop:pageOffsetTop,
            pageWidth:pageWidth,
            allphotoMarkToolWidth:allphotoMarkToolWidth,
            that:that
        });

        /**创建shadowRoot的子div，方便居中显示**/
        var  innerWrapDiv = document.createElement('div');
        innerWrapDiv.setAttribute('style', 'pointer-events: none !important; display: block !important');
        innerWrapDiv.style.pointerEvents = "none";

        if(!isBlank(photoMarkDivList)) {
            /**强转数组**/
            photoMarkDivList = Array.from(photoMarkDivList);
            photoMarkDivList.forEach(function (value, index, array) {
                innerWrapDiv.appendChild(value);
            })
        }
        shadowRoot.appendChild(innerWrapDiv);


        /**回填属性**/
        if (typeof outerDiv.attachShadow === 'function') {
            /* createShadowRoot Deprecated. Not for use in new websites. Use attachShadow*/
            outerDiv.attachShadow = shadowRoot;
        } else {
            outerDiv = shadowRoot;//如果不支持shadowRoot标签则创建的外壳就是自己
        }
        /**将如果时body加载shadow dom随机插入rootDom内的任意位置**/
        var nodeList = rootDom.children;
        // var index = Math.floor(Math.random() * (nodeList.length - 1 ));
        // if (nodeList[index]&&(that.currentConfig.mode == that.renderModes.bodyMode)){//只有body才随机插入，防止其他通过id和class进行局部调用时定时器执行时因为随机插入而闪频
        //     rootDom.insertBefore(outerDiv, nodeList[index]);
        //     return plugId;
        // }
        /**插入到第一个元素前面，防止定时器执行时闪频，和影响其他样式**/
        if (nodeList[0]){
            rootDom.insertBefore(outerDiv, nodeList[0]);
        } else {
            rootDom.appendChild(outerDiv);
        }
        return plugId;

    }

    /**创建水印小块**/
    function createPhotoMarkDivList(obj){
        var rootDom=obj.rootDom,pageOffsetLeft=obj.pageOffsetLeft,
            pageOffsetTop=obj.pageOffsetTop,pageWidth=obj.pageWidth,
            allphotoMarkToolWidth=obj.allphotoMarkToolWidth,that=obj.that;
        var photoMarkDivList = new Array();
        var x=0;
        var y=0;
        for (var i = 0; i < that.defaultSettings.rows; i++) {

            if (!isBlank(rootDom)) {
                y = pageOffsetTop + that.defaultSettings.y + (that.defaultSettings.ySpace + that.defaultSettings.height) * i;
            } else {
                y = that.defaultSettings.y + (that.defaultSettings.ySpace + that.defaultSettings.height) * i;
            }
            for (var j = 0; j < that.defaultSettings.cols; j++) {
                if (!isBlank(rootDom)) {
                    x = pageOffsetLeft + that.defaultSettings.x + (pageWidth - allphotoMarkToolWidth) / 2 + (that.defaultSettings.width + that.defaultSettings.xSpace) * j;
                } else {
                    x = that.defaultSettings.x + (pageWidth - allphotoMarkToolWidth) / 2 + (that.defaultSettings.width + that.defaultSettings.xSpace) * j;
                }
                var photoMarkDiv = document.createElement('div');
                /** //注释掉createTextNode，改为innerHTML使该工具支持传入html标签文本显示,即可定制化换行，以及加入css等功能
                 var oText=document.createTextNode(that.defaultSettings.content);
                 photoMarkDiv.appendChild(oText);**/
                photoMarkDiv.innerHTML = that.defaultSettings.content;

                /*设置水印相关属性start*/
                photoMarkDiv.id = that.defaultSettings.childrenPrefixId + i + j;
                /*设置水印div倾斜显示*/
                photoMarkDiv.style.webkitTransform = "rotate(-" + that.defaultSettings.angle + "deg)";
                photoMarkDiv.style.MozTransform = "rotate(-" + that.defaultSettings.angle + "deg)";
                photoMarkDiv.style.msTransform = "rotate(-" + that.defaultSettings.angle + "deg)";
                photoMarkDiv.style.OTransform = "rotate(-" + that.defaultSettings.angle + "deg)";
                photoMarkDiv.style.transform = "rotate(-" + that.defaultSettings.angle + "deg)";
                photoMarkDiv.style.visibility = "";
                photoMarkDiv.style.position = "absolute";
                /*选不中*/
                photoMarkDiv.style.left = x + 'px';
                photoMarkDiv.style.top = y + 'px';
                photoMarkDiv.style.overflow = "hidden";
                photoMarkDiv.style.zIndex = "9999999";
                photoMarkDiv.style.opacity = that.defaultSettings.opacity;
                photoMarkDiv.style.fontSize = that.defaultSettings.fontSize;
                photoMarkDiv.style.fontFamily = that.defaultSettings.fontFamily;
                photoMarkDiv.style.color = that.defaultSettings.color;
                photoMarkDiv.style.textAlign = "center";
                photoMarkDiv.style.width = that.defaultSettings.width + 'px';
                photoMarkDiv.style.height = that.defaultSettings.height + 'px';
                photoMarkDiv.style.display = "block";
                photoMarkDiv.style['-ms-user-select'] = "none";
                /*设置水印相关属性end*/
                photoMarkDivList.push(photoMarkDiv);

            }
        }
        return photoMarkDivList;
    }

    /**水印添加load和resize事件**/
    function addListen(settings,that) {
        tempSetting = settings;
        currentThat = that;
        // alert("初始化监听");
        /**加载水印事件函数**/
        registerListenEvent = function  (){
            loadMark(tempSetting,currentThat);
        }
        window.addEventListener('load', registerListenEvent);
        window.addEventListener('resize', registerListenEvent);
    };

    /**移除load和resize事件**/
    function removeListen() {
        // alert("移除监听");
        window.removeEventListener('load', registerListenEvent);
        window.removeEventListener('resize', registerListenEvent);
    };

    return PhotoMarkTool;
}));

