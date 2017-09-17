/**
 *  @file ʵ����ͨ��highlight������
 *  @name Highlight
 *  @desc �������Ч��
 *  @import zepto.js
 */
(function( $ ) {
    var $doc = $( document ),
        $el,    // ��ǰ���µ�Ԫ��
        timer;    // ���ǵ���������ʱ���ܸ����������õ���100ms��ʱ

    // �����Ƴ�className.
    function dismiss() {
        var cls = $el.attr( 'hl-cls' );

        clearTimeout( timer );
        $el.removeClass( cls ).removeAttr( 'hl-cls' );
        $el = null;
        $doc.off( 'touchend touchmove touchcancel', dismiss );
    }

    /**
     * @name highlight
     * @desc ���õ�ϵͳ�ĸ���������ָ�ƶ���Ԫ����ʱ���ָ��class����ָ�ƿ�ʱ���Ƴ���class.
     * ��������className�ǣ��˲���������¼��󶨡�
     * 
     * �˷���֧�ִ���selector, �˷�ʽ���õ��¼���������dom����ء�
     * @grammar  highlight(className, selector )   ? self
     * @grammar  highlight(className )   ? self
     * @grammar  highlight()   ? self
     * @example var div = $('div');
     * div.highlight('div-hover');
     *
     * $('a').highlight();// ������a���Դ��ĸ���Ч��ȥ����
     */
    $.fn.highlight = function( className, selector ) {
        return this.each(function() {
            var $this = $( this );

            $this.css( '-webkit-tap-highlight-color', 'rgba(255,255,255,0)' )
                    .off( 'touchstart.hl' );

            className && $this.on( 'touchstart.hl', function( e ) {
                var match;

                $el = selector ? (match = $( e.target ).closest( selector,
                        this )) && match.length && match : $this;

                // selctor�����Ҳ���Ԫ�ء�
                if ( $el ) {
                    $el.attr( 'hl-cls', className );
                    timer = setTimeout( function() {
                        $el.addClass( className );
                    }, 100 );
                    $doc.on( 'touchend touchmove touchcancel', dismiss );
                }
            } );
        });
    };
})( Zepto );
